/*
 * Squash the Bugs: a tiny whack-a-mole game for the video game theme.
 *
 * functions.js loads this file the first time someone presses PRESS START on the
 * home page. Bugs climb out of pipes; tap or click them (or press 1-9, which match
 * the pipes in reading order) before they crawl back in and ship to production.
 * Golden bugs are worth 3 points, and the bugs speed up as the clock runs down.
 */
window.BugSquash = (function () {
    var ROUND_SECONDS = 30;
    var BEST_SCORE_KEY = 'bugSquashBest';

    // The bug, one character per pixel: # is its body, o is an eye
    var BUG_PIXELS = [
        '...#...#...',
        '....#.#....',
        '...#o#o#...',
        '#.#######.#',
        '.#########.',
        '..#######..',
        '.#########.',
        '#.#######.#',
        '...#####...',
        '..#.....#..'
    ];

    var dialog, holes, scoreEl, timeEl, bestEl, board, overlay, messageEl, startButton;
    var score = 0;
    var missed = 0;
    var timeLeft = ROUND_SECONDS;
    var running = false;
    var timers = [];

    function bugSvg() {
        var pixels = '';
        BUG_PIXELS.forEach(function (row, y) {
            row.split('').forEach(function (cell, x) {
                if (cell === '#') {
                    pixels += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
                } else if (cell === 'o') {
                    pixels += '<rect class="bug-squash-eye" x="' + x + '" y="' + y + '" width="1" height="1"/>';
                }
            });
        });
        return '<svg viewBox="0 0 11 10" shape-rendering="crispEdges" aria-hidden="true">' + pixels + '</svg>';
    }

    function build() {
        var holesHtml = '';
        for (var i = 1; i <= 9; i++) {
            holesHtml +=
                '<div class="bug-squash-hole">' +
                '<span class="bug-squash-bug">' + bugSvg() + '</span>' +
                '<span class="bug-squash-key" aria-hidden="true">' + i + '</span>' +
                '</div>';
        }

        dialog = document.createElement('dialog');
        dialog.className = 'bug-squash';
        dialog.setAttribute('aria-labelledby', 'bug-squash-title');
        dialog.innerHTML =
            '<div class="bug-squash-inner">' +
            '<button type="button" class="bug-squash-close" aria-label="Close game">✕</button>' +
            '<h2 id="bug-squash-title">Squash the Bugs</h2>' +
            '<div class="bug-squash-hud">' +
            '<div>Score<b data-score>0</b></div>' +
            '<div>Time<b data-time>' + ROUND_SECONDS + '</b></div>' +
            '<div>Best<b data-best>0</b></div>' +
            '</div>' +
            '<div class="bug-squash-stage">' +
            '<div class="bug-squash-board" tabindex="-1">' + holesHtml + '</div>' +
            '<div class="bug-squash-overlay">' +
            '<p class="bug-squash-message" aria-live="polite"></p>' +
            '<button type="button" class="bug-squash-button" autofocus></button>' +
            '</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(dialog);

        holes = Array.prototype.slice.call(dialog.querySelectorAll('.bug-squash-hole'));
        scoreEl = dialog.querySelector('[data-score]');
        timeEl = dialog.querySelector('[data-time]');
        bestEl = dialog.querySelector('[data-best]');
        board = dialog.querySelector('.bug-squash-board');
        overlay = dialog.querySelector('.bug-squash-overlay');
        messageEl = dialog.querySelector('.bug-squash-message');
        startButton = dialog.querySelector('.bug-squash-button');

        // pointerdown instead of click, so a quick tap counts the moment it lands
        holes.forEach(function (hole) {
            hole.addEventListener('pointerdown', function (ev) {
                ev.preventDefault();
                squash(hole);
            });
        });

        startButton.addEventListener('click', start);
        dialog.querySelector('.bug-squash-close').addEventListener('click', function () {
            dialog.close();
        });

        // Clicking the dimmed page around the game closes it (Escape does too, built in)
        dialog.addEventListener('click', function (ev) {
            if (ev.target === dialog) {
                dialog.close();
            }
        });

        dialog.addEventListener('keydown', function (ev) {
            if (running && ev.key >= '1' && ev.key <= '9') {
                squash(holes[Number(ev.key) - 1]);
            }
        });

        // However the game gets closed, stop it
        dialog.addEventListener('close', stop);
    }

    function readBest() {
        try {
            return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveBest(value) {
        try {
            localStorage.setItem(BEST_SCORE_KEY, String(value));
        } catch (e) { }
    }

    function later(fn, ms) {
        var id = setTimeout(fn, ms);
        timers.push(id);
        return id;
    }

    function clearTimers() {
        timers.forEach(clearTimeout);
        timers = [];
    }

    function render() {
        scoreEl.textContent = score;
        timeEl.textContent = timeLeft;
        bestEl.textContent = readBest();
    }

    function showMessage(message, buttonLabel) {
        messageEl.textContent = message;
        startButton.textContent = buttonLabel;
        overlay.hidden = false;
        startButton.focus();
    }

    function start() {
        clearTimers();
        holes.forEach(hide);
        score = 0;
        missed = 0;
        timeLeft = ROUND_SECONDS;
        running = true;
        render();
        overlay.hidden = true;
        // Keep focus inside the game so the number keys keep working
        board.focus();
        later(tick, 1000);
        later(popBug, 500);
    }

    function tick() {
        if (!running) {
            return;
        }
        timeLeft--;
        timeEl.textContent = timeLeft;
        if (timeLeft <= 0) {
            end();
        } else {
            later(tick, 1000);
        }
    }

    function popBug() {
        if (!running) {
            return;
        }

        // The longer the round goes, the faster bugs come and go
        var elapsed = ROUND_SECONDS - timeLeft;
        var free = holes.filter(function (hole) {
            return !hole.classList.contains('is-up');
        });

        if (free.length) {
            var hole = free[Math.floor(Math.random() * free.length)];
            hole.classList.add('is-up');
            hole.classList.toggle('is-golden', Math.random() < 0.1);
            hole.escapeTimer = later(function () {
                escape(hole);
            }, Math.max(500, 1200 - elapsed * 25));
        }

        later(popBug, Math.max(300, 800 - elapsed * 15) + Math.random() * 300);
    }

    function escape(hole) {
        if (hole.classList.contains('is-up') && !hole.classList.contains('is-squashed')) {
            missed++;
        }
        hide(hole);
    }

    function squash(hole) {
        if (!running || !hole.classList.contains('is-up') || hole.classList.contains('is-squashed')) {
            return;
        }
        clearTimeout(hole.escapeTimer);
        score += hole.classList.contains('is-golden') ? 3 : 1;
        scoreEl.textContent = score;
        hole.classList.add('is-squashed');
        later(function () {
            hide(hole);
        }, 300);
    }

    function hide(hole) {
        hole.classList.remove('is-up', 'is-squashed', 'is-golden');
    }

    function stop() {
        running = false;
        clearTimers();
        holes.forEach(hide);
    }

    function end() {
        stop();

        var isNewBest = score > readBest();
        if (isNewBest) {
            saveBest(score);
        }
        render();

        var production = missed === 0
            ? 'Zero bugs reached production. Flawless.'
            : missed + (missed === 1 ? ' bug' : ' bugs') + ' made it to production. Somebody is getting paged tonight.';
        showMessage('Game over! You scored ' + score + '. ' + production + (isNewBest ? ' New high score!' : ''), 'Play again');
    }

    function loadStyles(done) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'resources/css/bug-squash.css';
        link.onload = link.onerror = done;
        document.head.appendChild(link);
    }

    function open() {
        function show() {
            stop();
            timeLeft = ROUND_SECONDS;
            score = 0;
            render();
            dialog.showModal();
            showMessage('Bugs are crawling out of the pipes! Squash them before they ship to production. ' +
                'Golden bugs are worth 3.', 'Start');
        }

        if (dialog) {
            show();
        } else {
            build();
            loadStyles(show);
        }
    }

    return { open: open };
})();
