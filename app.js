(function () {
    const TEAMS = ['B5', 'BW', 'EA', 'ETM', 'FRM', 'LAR', 'MF', 'RGF', 'SIC', 'TAGX'];

    function getTeamPaths(team) {
        return { logo: `Layers/${team} 150.png` };
    }

    /** Finnish weekday name in genitive (e.g. "sunnuntain", "maanantain"). 0 = Sunday. */
    function getDayNameGenitive() {
        var days = ['sunnuntain', 'maanantain', 'tiistain', 'keskiviikon', 'torstain', 'perjantain', 'lauantain'];
        return days[new Date().getDay()] || days[0];
    }

    /** Parse "12 FEBRUARY 2026" and return Finnish weekday in genitive. */
    function getDayNameGenitiveForDate(dateStr) {
        var days = ['sunnuntain', 'maanantain', 'tiistain', 'keskiviikon', 'torstain', 'perjantain', 'lauantain'];
        var months = { JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5, JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11 };
        var parts = (dateStr || '').trim().split(/\s+/);
        if (parts.length < 3) return days[new Date().getDay()];
        var day = parseInt(parts[0], 10);
        var month = months[parts[1].toUpperCase()];
        var year = parseInt(parts[2], 10);
        if (isNaN(day) || month == null || isNaN(year)) return days[new Date().getDay()];
        var d = new Date(year, month, day);
        return days[d.getDay()] || days[0];
    }

    /** Get unique Date values from matches, sorted. newestFirst true = results order, false = upcoming order. */
    function getUniqueDatesSorted(matches, newestFirst) {
        var set = {};
        matches.forEach(function (m) { if (m && m.Date) set[m.Date] = true; });
        var list = Object.keys(set);
        if (list.length === 0) return list;
        var months = { JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5, JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11 };
        function toKey(dateStr) {
            var parts = (dateStr || '').trim().split(/\s+/);
            if (parts.length < 3) return dateStr;
            var y = parseInt(parts[2], 10);
            var m = (months[parts[1].toUpperCase()] != null ? months[parts[1].toUpperCase()] : 0) + 1;
            var d = parseInt(parts[0], 10);
            return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
        }
        list.sort(function (a, b) {
            var ka = toKey(a);
            var kb = toKey(b);
            return newestFirst ? (kb > ka ? 1 : kb < ka ? -1 : 0) : (ka > kb ? 1 : ka < kb ? -1 : 0);
        });
        return list;
    }

    var cachedMatches = [];
    var currentMode = null; // 'tulokset' | 'ottelut'
    var getCenterValueFn = null;
    var currentMatchCount = 3; // 1–3, how many match rows are active (canvas + side panel + prompt)
    var cachedTeamInfo = null; // { "EA": "description", ... }

    /** Parse "SIC vs BW" or "SIC vs. BW" into [left, right] team codes */
    function parseMatch(matchStr) {
        var s = (matchStr || '').replace(/\s*vs\.?\s*/i, '|').trim();
        var parts = s.split('|').map(function (p) { return p.trim(); });
        if (parts.length >= 2) return { left: parts[0], right: parts[1] };
        return { left: '', right: '' };
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
    function updateTitle() {
        const input = document.getElementById('input-main-title');
        const el = document.getElementById('main-title-text');
        if (!input || !el) return;
        var text = (input.value.trim() || getDayNameGenitive() + ' tulokset');
        var idx = text.indexOf(' ');
        if (idx > 0) {
            el.innerHTML = escapeHtml(text.slice(0, idx)) + '<br>' + escapeHtml(text.slice(idx + 1));
        } else {
            el.textContent = text;
        }
    }

    function updateSubtitle() {
        var input = document.getElementById('input-subtitle');
        var el = document.getElementById('subtitle-text');
        if (input && el) el.textContent = (input.value.trim() || 'PELIEN VODIT YOUTUBESSA @FINNHOUSELOL');
    }

    /** "Best of 3" -> "BO3", "Best of 5" -> "BO5" */
    function formatBestOf(s) {
        if (!s || typeof s !== 'string') return '';
        var m = s.trim().match(/Best\s+of\s+(\d+)/i);
        return m ? 'BO' + m[1] : s;
    }

    function isFinalystiEnabled() {
        var el = document.getElementById('input-finalysti-enabled');
        return el ? el.checked : false;
    }

    /** Finalysti Studio row is only shown for upcoming (ottelut), not for results (tulokset). */
    function isFinalystiActive() {
        return isFinalystiEnabled() && currentMode === 'ottelut';
    }

    function getFinalystiTime() {
        var el = document.getElementById('input-finalysti-time');
        return (el && el.value ? el.value.trim() : '17:00') || '17:00';
    }

    function setRow1TeamsVisible(visible) {
        var display = visible ? '' : 'none';
        ['m1-logo-left', 'm1-logo-right', 'm1-name-left', 'm1-name-right'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = display;
        });
    }

    function updateFinalystiRow() {
        var scoreEl = document.getElementById('m1-score');
        if (!scoreEl) return;
        scoreEl.classList.add('score-finalysti-row');
        var mainText = 'FINALYSTI STUDIO';
        var timeText = getFinalystiTime().replace(/-/g, '–');
        scoreEl.innerHTML = '<span class="score-main">' + escapeHtml(mainText) + '</span><span class="score-bestof">' + escapeHtml(timeText) + '</span>';
    }

    function updateMatch(matchNum, optionalMatch) {
        const m = matchNum;
        if (m === 1 && isFinalystiActive()) {
            updateFinalystiRow();
            return;
        }
        const leftVal = document.getElementById(`input-m${m}-left`).value;
        const rightVal = document.getElementById(`input-m${m}-right`).value;
        const scoreVal = document.getElementById(`input-m${m}-score`).value.trim() || '0–0';

        const leftPaths = getTeamPaths(leftVal);
        const rightPaths = getTeamPaths(rightVal);

        document.getElementById(`m${m}-logo-left`).src = leftPaths.logo;
        document.getElementById(`m${m}-logo-left`).alt = leftVal;
        document.getElementById(`m${m}-name-left`).textContent = leftVal;

        document.getElementById(`m${m}-logo-right`).src = rightPaths.logo;
        document.getElementById(`m${m}-logo-right`).alt = rightVal;
        document.getElementById(`m${m}-name-right`).textContent = rightVal;

        const scoreEl = document.getElementById(`m${m}-score`);
        if (m === 1) scoreEl.classList.remove('score-finalysti-row');
        const mainText = scoreVal.replace(/-/g, '–');
        var showBestOf = arguments[2] === true;
        if (showBestOf && optionalMatch && optionalMatch.BestOf) {
            var bo3Text = formatBestOf(optionalMatch.BestOf);
            scoreEl.innerHTML = '<span class="score-main">' + escapeHtml(mainText) + '</span><span class="score-bestof">' + escapeHtml(bo3Text) + '</span>';
        } else {
            scoreEl.textContent = mainText;
        }
    }

    /** Show only the first `count` match rows (1–4). When Finalysti box is on (upcoming only), row 1 is Finalysti and match rows are 2,3,4 (max 3). */
    function setMatchRowsVisible(count) {
        currentMatchCount = count;
        var finalysti = isFinalystiActive();
        var canvas = document.querySelector('.canvas');
        if (canvas) {
            var rowSelectors = [
                '.match1-bg, .match1-left, .match1-right, .match1-left-name, .match1-right-name, .match1-score',
                '.match2-bg, .match2-left, .match2-right, .match2-left-name, .match2-right-name, .match2-score',
                '.match3-bg, .match3-left, .match3-right, .match3-left-name, .match3-right-name, .match3-score',
                '.match4-bg, .match4-left, .match4-right, .match4-left-name, .match4-right-name, .match4-score'
            ];
            for (var i = 0; i < 4; i++) {
                var show = finalysti
                    ? (i === 0 || i <= count)
                    : (i < count);
                var display = show ? '' : 'none';
                rowSelectors[i].split(', ').forEach(function (sel) {
                    var el = canvas.querySelector(sel);
                    if (el) el.style.display = display;
                });
            }
            if (finalysti) {
                setRow1TeamsVisible(false);
            }
        }
        var fs1 = document.getElementById('match-control-1');
        if (fs1) fs1.style.display = finalysti ? 'none' : (1 <= count ? '' : 'none');
        for (var i = 2; i <= 4; i++) {
            var fieldset = document.getElementById('match-control-' + i);
            if (fieldset) fieldset.style.display = (finalysti ? i <= count + 1 : i <= count) ? '' : 'none';
        }
    }

    function applyMatchesToList(matches, title, getCenterValue, showBestOf) {
        var titleInput = document.getElementById('input-main-title');
        if (titleInput) titleInput.value = title;
        updateTitle();
        var finalysti = isFinalystiActive();
        var matchCount = finalysti ? Math.min(3, matches.length) : Math.min(4, matches.length);
        var startSlot = finalysti ? 2 : 1;
        for (var i = 0; i < matchCount; i++) {
            var slot = startSlot + i;
            var leftSel = document.getElementById('input-m' + slot + '-left');
            var rightSel = document.getElementById('input-m' + slot + '-right');
            var centerInput = document.getElementById('input-m' + slot + '-score');
            if (!leftSel || !rightSel || !centerInput) continue;
            var m = matches[i];
            if (!m) continue;
            var teams = parseMatch(m.Match);
            leftSel.value = TEAMS.indexOf(teams.left) >= 0 ? teams.left : teams.left;
            rightSel.value = TEAMS.indexOf(teams.right) >= 0 ? teams.right : teams.right;
            centerInput.value = getCenterValue(m);
            updateMatch(slot, m, showBestOf);
        }
        if (finalysti) {
            updateFinalystiRow();
            setRow1TeamsVisible(false);
        } else {
            setRow1TeamsVisible(true);
            var m1Score = document.getElementById('m1-score');
            if (m1Score) m1Score.classList.remove('score-finalysti-row');
        }
        setMatchRowsVisible(matchCount);
    }

    /** Parse teams.txt content into { code: description }. */
    function parseTeamsTxt(text) {
        var out = {};
        var blocks = text.split(/\n={10,}\n/);
        blocks.forEach(function (block) {
            var lines = block.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
            if (lines.length === 0) return;
            var first = lines[0];
            var code = null;
            var inParens = first.match(/\(([^)]+)\)/g);
            if (inParens) {
                for (var p = 0; p < inParens.length; p++) {
                    var c = inParens[p].replace(/^\(|\)$/g, '');
                    if (TEAMS.indexOf(c) >= 0 || c === 'TAGX' || c === 'RGF') { code = c; break; }
                }
            }
            if (!code && first.indexOf(' ') >= 0) code = first.split(/\s+/)[0];
            if (!code && first.toUpperCase() === 'TAGX') code = 'TAGX';
            if (!code) return;
            if (code.toUpperCase() === 'TAGX') code = 'TAGX';
            var descLines = [];
            for (var i = 1; i < lines.length; i++) {
                if (lines[i] === 'Pelaajat:') break;
                if (lines[i] !== '(No description)' && !/^=+$/.test(lines[i])) descLines.push(lines[i]);
            }
            out[code] = descLines.join(' ').trim() || '';
        });
        return out;
    }

    function fillDayDropdown(dates) {
        var sel = document.getElementById('input-day');
        if (!sel) return;
        sel.innerHTML = '';
        if (dates.length === 0) {
            sel.disabled = true;
            sel.appendChild(new Option('– Ei päiviä –', ''));
            return;
        }
        sel.disabled = false;
        dates.forEach(function (dateStr) {
            sel.appendChild(new Option(dateStr, dateStr));
        });
    }

    function applyDay(dateStr) {
        if (!dateStr || !currentMode || !getCenterValueFn) return;
        var forDay = cachedMatches.filter(function (m) { return m.Date === dateStr; });
        if (forDay.length === 0) return;
        var dayName = getDayNameGenitiveForDate(dateStr);
        var suffix = currentMode === 'tulokset' ? (forDay.length === 1 ? ' tulos' : ' tulokset') : (forDay.length === 1 ? ' ottelu' : ' ottelut');
        var title = dayName + suffix;
        applyMatchesToList(forDay, title, getCenterValueFn, currentMode === 'ottelut');
    }

    function loadAndApplyResults() {
        fetch('matches.json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var results = data.results || [];
                if (results.length === 0) {
                    alert('Ei tuloksia. Aja scrapematches.py ja tarkista että tuloksia on.');
                    return;
                }
                cachedMatches = results;
                currentMode = 'tulokset';
                getCenterValueFn = function (m) { return m.Score || '0–0'; };
                var subInput = document.getElementById('input-subtitle');
                if (subInput) subInput.value = 'PELIEN VODIT YOUTUBESSA @FINNHOUSELOL';
                updateSubtitle();
                var dates = getUniqueDatesSorted(results, true);
                fillDayDropdown(dates);
                var firstDate = dates[0];
                var daySel = document.getElementById('input-day');
                if (daySel) daySel.value = firstDate || '';
                applyDay(firstDate);
            })
            .catch(function () {
                alert('matches.json ei löydy. Aja ensin: python scrapematches.py');
            });
    }

    function loadAndApplyUpcoming() {
        fetch('matches.json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var upcoming = data.upcoming || [];
                if (upcoming.length === 0) {
                    alert('Ei tulevia otteluita. Aja scrapematches.py ja tarkista että otteluita on.');
                    return;
                }
                cachedMatches = upcoming;
                currentMode = 'ottelut';
                getCenterValueFn = function (m) { return m.Time || '–'; };
                var subInput = document.getElementById('input-subtitle');
                if (subInput) subInput.value = 'KATSO LIVENÄ TWITCH.TV/FINNHOUSE';
                updateSubtitle();
                var dates = getUniqueDatesSorted(upcoming, false);
                fillDayDropdown(dates);
                var firstDate = dates[0];
                var daySel = document.getElementById('input-day');
                if (daySel) daySel.value = firstDate || '';
                applyDay(firstDate);
            })
            .catch(function () {
                alert('matches.json ei löydy. Aja ensin: python scrapematches.py');
            });
    }

    function copySlotToSlot(fromSlot, toSlot) {
        var leftFrom = document.getElementById('input-m' + fromSlot + '-left');
        var rightFrom = document.getElementById('input-m' + fromSlot + '-right');
        var scoreFrom = document.getElementById('input-m' + fromSlot + '-score');
        var leftTo = document.getElementById('input-m' + toSlot + '-left');
        var rightTo = document.getElementById('input-m' + toSlot + '-right');
        var scoreTo = document.getElementById('input-m' + toSlot + '-score');
        if (leftFrom && leftTo) leftTo.value = leftFrom.value;
        if (rightFrom && rightTo) rightTo.value = rightFrom.value;
        if (scoreFrom && scoreTo) scoreTo.value = scoreFrom.value;
    }

    function onFinalystiToggle() {
        if (currentMode !== 'ottelut') {
            setRow1TeamsVisible(true);
            var m1Score = document.getElementById('m1-score');
            if (m1Score) m1Score.classList.remove('score-finalysti-row');
            setMatchRowsVisible(currentMatchCount);
            [1, 2, 3, 4].forEach(updateMatch);
            return;
        }
        if (isFinalystiEnabled()) {
            copySlotToSlot(3, 4);
            copySlotToSlot(2, 3);
            copySlotToSlot(1, 2);
            document.getElementById('input-m1-left').value = TEAMS[0];
            document.getElementById('input-m1-right').value = TEAMS[1];
            document.getElementById('input-m1-score').value = '0–0';
            updateFinalystiRow();
            setRow1TeamsVisible(false);
            setMatchRowsVisible(Math.min(3, currentMatchCount));
            [2, 3, 4].forEach(updateMatch);
        } else {
            setRow1TeamsVisible(true);
            copySlotToSlot(2, 1);
            copySlotToSlot(3, 2);
            copySlotToSlot(4, 3);
            var m4Left = document.getElementById('input-m4-left');
            var m4Right = document.getElementById('input-m4-right');
            var m4Score = document.getElementById('input-m4-score');
            if (m4Left) m4Left.value = TEAMS[0];
            if (m4Right) m4Right.value = TEAMS[1];
            if (m4Score) m4Score.value = '0–0';
            setMatchRowsVisible(currentMatchCount);
            [1, 2, 3].forEach(updateMatch);
        }
    }

    function setupListeners() {
        var titleInput = document.getElementById('input-main-title');
        if (titleInput) {
            titleInput.addEventListener('input', updateTitle);
            titleInput.addEventListener('change', updateTitle);
        }
        var subInput = document.getElementById('input-subtitle');
        if (subInput) {
            subInput.addEventListener('input', updateSubtitle);
            subInput.addEventListener('change', updateSubtitle);
        }
        var daySel = document.getElementById('input-day');
        if (daySel) daySel.addEventListener('change', function () { applyDay(daySel.value); });
        var finalystiCheck = document.getElementById('input-finalysti-enabled');
        if (finalystiCheck) finalystiCheck.addEventListener('change', onFinalystiToggle);
        var finalystiTime = document.getElementById('input-finalysti-time');
        if (finalystiTime) {
            finalystiTime.addEventListener('input', function () { if (isFinalystiEnabled()) updateFinalystiRow(); });
            finalystiTime.addEventListener('change', function () { if (isFinalystiEnabled()) updateFinalystiRow(); });
        }
        [1, 2, 3, 4].forEach(function (m) {
            ['left', 'right'].forEach(function (side) {
                const sel = document.getElementById(`input-m${m}-${side}`);
                if (sel) sel.addEventListener('change', function () { updateMatch(m); });
            });
            const scoreInput = document.getElementById(`input-m${m}-score`);
            if (scoreInput) {
                scoreInput.addEventListener('input', function () { updateMatch(m); });
                scoreInput.addEventListener('change', function () { updateMatch(m); });
            }
        });
    }

    var DESIGN_W = 1080;
    var DESIGN_H = 1350;

    function updateCanvasScale() {
        var wrap = document.getElementById('canvas-wrap');
        if (!wrap) return;
        var scale = Math.min(1, window.innerHeight / DESIGN_H, (window.innerWidth - 48) / DESIGN_W);
        wrap.style.setProperty('--canvas-scale', scale);
        wrap.style.width = Math.round(DESIGN_W * scale) + 'px';
        wrap.style.height = Math.round(DESIGN_H * scale) + 'px';
    }

    function downloadImage() {
        var canvasEl = document.querySelector('.canvas');
        var wrap = document.getElementById('canvas-wrap');
        if (!canvasEl || !wrap || !window.htmlToImage || typeof window.htmlToImage.toPng !== 'function') {
            alert('Lataus ei käytössä. Tarkista, että html-to-image latautuu.');
            return;
        }
        var btn = document.getElementById('download-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Luodaan…';
        }
        var savedWidth = wrap.style.width;
        var savedHeight = wrap.style.height;
        var savedScale = wrap.style.getPropertyValue('--canvas-scale');
        var savedPosition = wrap.style.position;
        var savedLeft = wrap.style.left;
        var savedOverflow = canvasEl.style.overflow;
        wrap.style.width = DESIGN_W + 'px';
        wrap.style.height = DESIGN_H + 'px';
        wrap.style.setProperty('--canvas-scale', '1');
        wrap.style.position = 'fixed';
        wrap.style.left = '-99999px';
        wrap.style.overflow = 'visible';
        canvasEl.style.overflow = 'visible';
        /* Shift content up so title + shadow aren’t clipped at top; bottom is cropped slightly */
        function doCapture() {
            return window.htmlToImage.toPng(canvasEl, {
                pixelRatio: 2,
                backgroundColor: '#030617'
            });
        }
        doCapture().then(function (dataUrl) {
            try {
                var link = document.createElement('a');
                link.download = 'fpl-sunnuntain-tulokset.png';
                link.href = dataUrl;
                link.click();
            } catch (e) {
                if (e.name === 'SecurityError') {
                    alert(
                        'Kuvan lataus ei toimi, kun sivu on avattu suoraan tiedostosta (file://).\n\n' +
                        'Avaa sivu paikallisella palvelimella:\n' +
                        '• VS Code: asenna "Live Server" ja käynnistä se, avaa sitten http://localhost:...\n' +
                        '• Tai terminaalissa: npx serve . ja avaa http://localhost:3000'
                    );
                } else {
                    throw e;
                }
            }
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Lataa kuva (PNG)';
            }
        }).catch(function (err) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Lataa kuva (PNG)';
            }
            console.error(err);
            alert('Kuvan luonti epäonnistui.');
        }).finally(function () {
            canvasEl.style.overflow = savedOverflow || '';
            wrap.style.overflow = '';
            wrap.style.width = savedWidth;
            wrap.style.height = savedHeight;
            wrap.style.setProperty('--canvas-scale', savedScale || '');
            wrap.style.position = savedPosition || '';
            wrap.style.left = savedLeft || '';
            updateCanvasScale();
        });
    }

    function init() {
        var titleInput = document.getElementById('input-main-title');
        if (titleInput) titleInput.value = getDayNameGenitive() + ' tulokset';
        updateTitle();
        updateSubtitle();
        setMatchRowsVisible(3);
        [1, 2, 3, 4].forEach(updateMatch);
        if (isFinalystiEnabled()) {
            setRow1TeamsVisible(false);
            updateFinalystiRow();
        }
        updateCanvasScale();
        window.addEventListener('resize', updateCanvasScale);
        setupListeners();
        var downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) downloadBtn.addEventListener('click', downloadImage);
        var typeSel = document.getElementById('input-data-type');
        if (typeSel) typeSel.addEventListener('change', function () {
            var type = (typeSel && typeSel.value) || '';
            if (type === 'tulokset') loadAndApplyResults();
            else if (type === 'ottelut') loadAndApplyUpcoming();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
