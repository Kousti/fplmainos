from datetime import datetime
from zoneinfo import ZoneInfo

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import os
import re
import time

# Team code alias from external source to our code (if needed)
TEAM_ALIAS = {}

# Scraped times are in the runner's local TZ (site shows local time). Store always in Finnish time.
FIN_TZ = ZoneInfo("Europe/Helsinki")
MONTHS_UP = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]


def _is_finnish_timezone():
    """True if the current process is running in Europe/Helsinki (same UTC offset as Finland)."""
    try:
        now_utc = datetime.now(ZoneInfo("UTC"))
        local_tz = datetime.now().astimezone().tzinfo
        if local_tz is None:
            return False
        local_offset = now_utc.astimezone(local_tz).utcoffset()
        fin_offset = now_utc.astimezone(FIN_TZ).utcoffset()
        return local_offset == fin_offset
    except Exception:
        return False


def _convert_to_finnish_time(date_text, time_val, from_tz):
    """Parse Date + Time in from_tz, return (date_str, time_str) in Europe/Helsinki."""
    try:
        parts = date_text.strip().split()
        if len(parts) != 3:
            return date_text, time_val
        day = int(parts[0])
        month_name = parts[1].upper()
        year = int(parts[2])
        month = next((i for i, m in enumerate(MONTHS_UP, 1) if m == month_name), None)
        if not month:
            return date_text, time_val
        t_parts = time_val.strip().split(":")
        hour = int(t_parts[0]) if t_parts else 0
        minute = int(t_parts[1]) if len(t_parts) > 1 else 0
        dt_src = datetime(year, month, day, hour, minute, 0, tzinfo=from_tz)
        dt_fin = dt_src.astimezone(FIN_TZ)
        date_fin = f"{dt_fin.day} {MONTHS_UP[dt_fin.month - 1]} {dt_fin.year}"
        time_fin = dt_fin.strftime("%H:%M")
        return date_fin, time_fin
    except Exception:
        return date_text, time_val


def to_finnish_time_if_needed(date_text, time_val):
    """If we're not in Finnish TZ, convert scraped (local) time to Finnish; otherwise leave as-is."""
    if _is_finnish_timezone():
        return date_text, time_val
    # Scraper runs in UTC (e.g. GitHub) or other TZ – treat scraped as that TZ and convert to Finnish
    from_tz = datetime.now().astimezone().tzinfo
    if from_tz is None:
        from_tz = ZoneInfo("UTC")
    return _convert_to_finnish_time(date_text, time_val, from_tz)


def normalize_team(t):
    return TEAM_ALIAS.get(t.strip().upper(), t.strip())


def scrape_leagues_gg(url):
    chrome_options = Options()
    if os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS"):
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=chrome_options
    )

    score_re = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")

    def parse_cards(require_score=False):
        """Parse visible match cards. If require_score=True, only keep cards that have a score."""
        out = []
        seen = set()
        match_cards = driver.find_elements(
            By.XPATH,
            "//div[contains(@class, 'rounded-3xl') and contains(@class, 'border-2')]",
        )
        for card in match_cards:
            try:
                time_el = card.find_elements(By.TAG_NAME, "time")
                if not time_el:
                    continue
                time_val = time_el[0].text.replace("\n", " ").strip().replace(" ", ":")

                teams = card.find_elements(By.CSS_SELECTOR, "span.font-semibold")
                team_names = [
                    t.text.strip()
                    for t in teams
                    if len(t.text.strip()) > 1 and t.text.strip().upper() != "VS"
                ]
                if len(team_names) < 2:
                    continue
                t1, t2 = team_names[0], team_names[1]
                t1, t2 = normalize_team(t1), normalize_team(t2)

                try:
                    date_el = card.find_element(By.XPATH, "./preceding::h4[1]")
                    date_text = date_el.text.strip()
                except Exception:
                    date_text = ""

                if not date_text or not any(c.isdigit() for c in date_text):
                    continue

                score_text = None
                try:
                    accent_divs = card.find_elements(
                        By.XPATH, ".//div[contains(@class, 'bg-accent')]"
                    )
                    for div in accent_divs:
                        raw = div.text.strip()
                        if score_re.match(raw):
                            score_text = raw
                            break
                except Exception:
                    pass

                if require_score and not score_text:
                    continue
                if not require_score and score_text:
                    continue

                # Best of X: look for "Best of 3" etc. in the card footer (right-aligned <p>)
                best_of = None
                try:
                    footer_ps = card.find_elements(
                        By.XPATH,
                        ".//div[contains(@class, 'backdrop-brightness-70')]//p[contains(@class, 'text-right')]",
                    )
                    bo_re = re.compile(r"Best\s+of\s+(\d+)", re.I)
                    for p in footer_ps:
                        raw = p.text.strip()
                        mo = bo_re.search(raw)
                        if mo:
                            best_of = "Best of " + mo.group(1)
                            break
                except Exception:
                    pass

                match_id = f"{date_text}-{time_val}-{t1}-{t2}"
                if match_id in seen:
                    continue
                seen.add(match_id)

                if score_text:
                    score_clean = re.sub(r"\s*-\s*", " – ", score_text.strip())
                    item = {
                        "Date": date_text,
                        "Time": time_val,
                        "Match": f"{t1} vs {t2}",
                        "Score": score_clean,
                    }
                    if best_of:
                        item["BestOf"] = best_of
                    out.append(item)
                else:
                    item = {
                        "Date": date_text,
                        "Time": time_val,
                        "Match": f"{t1} vs {t2}",
                    }
                    if best_of:
                        item["BestOf"] = best_of
                    out.append(item)
            except Exception:
                continue
        return out

    try:
        driver.get(url)
        print(f"Loading page: {url}")

        wait = WebDriverWait(driver, 15)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "h4")))
        time.sleep(2)

        # Click consent/cookie button if present (must be done before other clicks)
        try:
            consent_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((
                    By.CSS_SELECTOR,
                    "button.fc-cta-consent, button[aria-label='Consent']",
                ))
            )
            consent_btn.click()
            print("Clicked consent.")
            time.sleep(1)
        except Exception:
            pass  # No consent button or already consented

        # Scroll a bit so upcoming cards are loaded
        driver.execute_script("window.scrollTo(0, 600);")
        time.sleep(1)
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.5)

        # 1) Current view = Matches (upcoming) – scrape those
        print("Scraping upcoming matches…")
        upcoming = parse_cards(require_score=False)

        # 2) Click "Results" tab so result cards become visible
        results_btn = driver.find_elements(
            By.XPATH, "//button[contains(., 'Results')]"
        )
        if not results_btn:
            print("[!] 'Results' button not found; only upcoming will be shown.")
            return {"results": [], "upcoming": upcoming}
        results_btn[0].click()
        time.sleep(2)
        driver.execute_script("window.scrollTo(0, 800);")
        time.sleep(1)
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(0.5)

        # 3) Scrape result cards (with score)
        print("Scraping results…")
        results_with_score = parse_cards(require_score=True)

        # If scraper runs outside Finnish TZ (e.g. GitHub UTC), convert times to Finnish; if already in Finland, leave as-is
        def normalize_tz(match_list):
            for m in match_list:
                m["Date"], m["Time"] = to_finnish_time_if_needed(m["Date"], m["Time"])
        normalize_tz(results_with_score)
        normalize_tz(upcoming)

        return {
            "results": results_with_score,
            "upcoming": upcoming,
        }

    finally:
        driver.quit()


if __name__ == "__main__":
    import json
    import os

    target_url = "https://leagues.gg/competitions/cmp_01KCHFGYKEKYBG9J3451Q24PPX"
    data = scrape_leagues_gg(target_url)

    results = data["results"]
    upcoming = data["upcoming"]

    # Save JSON for the web app (same folder as script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "matches.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"results": results, "upcoming": upcoming}, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {json_path}")

    if results:
        print(f"\n{'DATE':<20} | {'TIME':<7} | {'MATCH':<20} | {'SCORE'}")
        print("-" * 65)
        for m in results:
            print(f"{m['Date']:<20} | {m['Time']:<7} | {m['Match']:<20} | {m['Score']}")
        print(f"\nFetched {len(results)} result(s).")

    if upcoming:
        print(f"\n{'DATE':<20} | {'TIME':<7} | {'MATCH'}")
        print("-" * 60)
        for m in upcoming:
            print(f"{m['Date']:<20} | {m['Time']:<7} | {m['Match']}")
        print(f"\nFetched {len(upcoming)} upcoming match(es).")

    if not results and not upcoming:
        print("\n[!] No matches found. The site layout may have changed or you are being blocked.")
