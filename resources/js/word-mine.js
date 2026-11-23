/*
 * Word Mine: a spelling game for kids, in Wordle's colors (opened from the video game theme).
 *
 * Spelling: the game says a word and a sentence that uses it (the sentence is on screen too,
 * with the word blanked out), and he spells it on a big keyboard. The row grows as he types, so
 * the game never gives away how many letters there are: deciding whether a word ends in a magic
 * E, or starts with "w" or "wh", is the whole point. Checking lines his spelling up against the
 * word the way a teacher would mark it: emerald for a right letter, gold for a letter that goes
 * somewhere else, stone for a wrong one, crossed out for an extra letter and an empty slot for a
 * missing one. After a miss comes a tip about the word's spelling pattern, and a Peek button
 * flashes the word for a moment. Words come in six levels by spelling pattern, moving up and
 * down with how he's doing, and words he missed come back a few words later.
 *
 * Mystery word: Wordle for kids. A 5-letter word, a clue like "It's an animal" and six tries.
 *
 * Nothing is ever lost: after enough misses the word is shown, and he types it once to finish.
 * Grown-ups can see his tricky words and pick a level by holding down the title.
 */
(function () {
    'use strict';

    const WORDS = window.WORD_MINE_WORDS;
    const LEVELS = WORDS.levels;
    const ALL_WORDS = new Map(LEVELS.flatMap(level => level.words.map(entry => [entry[0], entry])));

    const DEFAULT_LEVEL = 2; // W or WH: where his spelling mix-ups are
    const MAX_ROWS = 6; // tries on the board
    const MAX_LETTERS = 8; // the longest spelling word is 7
    const PEEK_AFTER = 3; // spelling misses before the word flashes up by itself
    const SHOW_AFTER = 5; // spelling misses before the word is shown to copy
    const UP_AFTER = 4; // words right on the first try in a row, to move up a level
    const DOWN_AFTER = 2; // words in a row that took 4 or more tries, to move down one
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // What to say about a word's spelling pattern after a miss
    const TIPS = {
        'short': 'Say it slowly and listen for every sound.',
        'just-w': 'This word starts with just "w". No "h"!',
        'wh': 'This word starts with "wh", like when and what.',
        'sh': 'Listen for the sh sound. It\'s spelled "sh".',
        'ch': 'Listen for the ch sound. It\'s spelled "ch".',
        'th': 'Listen for the th sound. It\'s spelled "th".',
        'ck': 'After a short vowel, the k sound at the end is spelled "ck".',
        'ng': 'The ng sound at the end is spelled "ng".',
        'ph': 'The f sound in this word is spelled "ph".',
        'magic-e': 'Magic E! An "e" at the end makes the vowel say its name.',
        'no-e': 'No magic E this time. The vowel makes its short sound.',
        'ai': 'The long a sound in the middle is spelled "ai".',
        'ay': 'At the end of a word, the long a sound is spelled "ay".',
        'ee': 'The long e sound in this word is spelled "ee".',
        'ea': 'The long e sound in this word is spelled "ea".',
        'oa': 'The long o sound in the middle is spelled "oa".',
        'ow': 'At the end of a word, the long o sound is often spelled "ow".',
        'igh': 'The long i sound in this word is spelled "igh".',
        'oo': 'The oo sound is spelled "oo".',
        'ue': 'The oo sound at the end of this word is spelled "ue".',
        'ar': 'Bossy R! The ar sound is spelled "ar".',
        'or': 'Bossy R! The or sound is spelled "or".',
        'ir': 'Bossy R! "ir", "ur" and "er" all sound the same. This word uses "ir".',
        'ur': 'Bossy R! "ir", "ur" and "er" all sound the same. This word uses "ur".',
        'er': 'Bossy R! "ir", "ur" and "er" all sound the same. This word uses "er".',
        'tricky': 'This is a tricky word that doesn\'t follow the rules. Tap Peek and take a good look!',
    };

    const CLUES = {
        animal: 'It\'s an animal.',
        food: 'It\'s something to eat.',
        drink: 'It\'s something to drink.',
        wear: 'It\'s something you wear.',
        ride: 'It\'s something you can ride in.',
        sky: 'You can see it in the sky.',
        home: 'You can find it in a house.',
        outside: 'You can find it outside.',
        color: 'It\'s a color.',
        number: 'It\'s a number.',
        body: 'It\'s part of your body.',
        fun: 'It\'s something fun to do or play with.',
    };

    // ---------- Saved progress (kept on this device only) ----------
    //
    // One object in localStorage under wordMine.save, with a version number, like Make Way's
    // save. To change its shape later, bump SAVE_VERSION and add a step to UPGRADES; a copy of
    // the old save is put aside first under wordMine.backup.v<old version>. (A brand-new field
    // with a sensible default doesn't need that.) Nothing here ever deletes anything.

    const SAVE_KEY = 'wordMine.save';
    const SAVE_VERSION = 1;
    const UPGRADES = {}; // each step turns a save of version n into version n + 1

    function storageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) { }
    }

    function parse(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    function loadSave() {
        let save = parse(storageGet(SAVE_KEY));
        if (!save || typeof save !== 'object' || Array.isArray(save)) {
            save = { version: SAVE_VERSION }; // a new player
        }
        if (!Number.isInteger(save.version) || save.version < 1) {
            save.version = 1;
        }
        if (save.version < SAVE_VERSION) {
            while (save.version < SAVE_VERSION) {
                const backupKey = 'wordMine.backup.v' + save.version;
                if (storageGet(backupKey) === null) {
                    storageSet(backupKey, JSON.stringify(save));
                }
                save = { ...UPGRADES[save.version](save), version: save.version + 1 };
            }
            storageSet(SAVE_KEY, JSON.stringify(save));
        }
        return save;
    }

    const saved = loadSave();
    const isCount = n => Number.isInteger(n) && n >= 0;
    const wordsIn = list => Array.isArray(list) ? list.filter(word => typeof word === 'string') : [];

    // Only take values from the save that make sense, so a damaged save can't break the game
    const state = {
        name: typeof saved.name === 'string' ? saved.name.slice(0, 16) : '',
        muted: saved.muted === true,
        started: saved.started === true,
        mode: saved.mode === 'mystery' ? 'mystery' : 'spell',
        level: Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= LEVELS.length ? saved.level : DEFAULT_LEVEL,
        streak: isCount(saved.streak) ? saved.streak : 0, // spelled right on the first try, in a row
        tough: isCount(saved.tough) ? saved.tough : 0, // took 4 or more tries, in a row
        spelled: isCount(saved.spelled) ? saved.spelled : 0,
        firstTry: isCount(saved.firstTry) ? saved.firstTry : 0,
        found: isCount(saved.found) ? saved.found : 0, // mystery words
        recent: wordsIn(saved.recent).slice(-25), // so words don't repeat too soon
        recentMystery: wordsIn(saved.recentMystery).slice(-50),
        // Missed words come back once `spelled` reaches `due`
        review: Array.isArray(saved.review)
            ? saved.review.filter(item => item && ALL_WORDS.has(item.word) && isCount(item.due)) : [],
        tricky: wordsIn(saved.tricky).filter(word => ALL_WORDS.has(word)).slice(-10), // for grown-ups
        round: null, // the word being played
        busy: false, // while a row is being revealed
    };

    // Anything in the save this version of the game doesn't know about is written back untouched
    function saveProgress() {
        Object.assign(saved, {
            name: state.name,
            muted: state.muted,
            started: state.started,
            mode: state.mode,
            level: state.level,
            streak: state.streak,
            tough: state.tough,
            spelled: state.spelled,
            firstTry: state.firstTry,
            found: state.found,
            recent: state.recent,
            recentMystery: state.recentMystery,
            review: state.review,
            tricky: state.tricky,
        });
        storageSet(SAVE_KEY, JSON.stringify(saved));
    }

    // Ask the browser to keep the save even if the iPad runs low on space
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => { });
    }

    // ---------- Little helpers ----------

    function randomItem(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function remember(list, word, keep) {
        list.push(word);
        list.splice(0, Math.max(0, list.length - keep));
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    }

    function withName(text) {
        return text.replace('{, name}', state.name ? ', ' + state.name : '');
    }

    // ---------- Marking a try ----------

    // Line a spelling up against the word, letter by letter, the way a teacher would mark it:
    // right, wrong, extra, missing, or two letters swapped. It's the cheapest way to turn one
    // into the other (an edit distance). An extra or missing letter costs 2, a swap of two
    // neighbors 2 and a wrong letter 3, so the marking keeps as many matching letters as it can:
    // "whent" for "went" is one extra letter, "kit" for "kite" one missing letter, "trane" for
    // "train" a missing i and an extra e, and "wnet" for "went" two letters to swap.
    const COST = { extra: 2, missing: 2, swap: 2, wrong: 3 };

    function markSpelling(guess, word) {
        const cost = [];
        for (let i = 0; i <= guess.length; i++) {
            cost.push([]);
            for (let j = 0; j <= word.length; j++) {
                if (i === 0 || j === 0) {
                    cost[i][j] = (i + j) * 2;
                    continue;
                }
                cost[i][j] = Math.min(
                    cost[i - 1][j - 1] + (guess[i - 1] === word[j - 1] ? 0 : COST.wrong),
                    cost[i - 1][j] + COST.extra,
                    cost[i][j - 1] + COST.missing);
                if (i > 1 && j > 1 && guess[i - 1] === word[j - 2] && guess[i - 2] === word[j - 1] && guess[i - 1] !== guess[i - 2]) {
                    cost[i][j] = Math.min(cost[i][j], cost[i - 2][j - 2] + COST.swap);
                }
            }
        }

        // Walk back from the end, taking whichever step got there
        const marks = [];
        let i = guess.length, j = word.length;
        while (i > 0 || j > 0) {
            const here = cost[i][j];
            if (i > 0 && j > 0 && guess[i - 1] === word[j - 1] && here === cost[i - 1][j - 1]) {
                marks.unshift({ letter: guess[i - 1], mark: 'right' });
                i--;
                j--;
            } else if (i > 1 && j > 1 && guess[i - 1] === word[j - 2] && guess[i - 2] === word[j - 1]
                && guess[i - 1] !== guess[i - 2] && here === cost[i - 2][j - 2] + COST.swap) {
                marks.unshift({ letter: guess[i - 2], mark: 'elsewhere' }, { letter: guess[i - 1], mark: 'elsewhere' });
                i -= 2;
                j -= 2;
            } else if (i > 0 && j > 0 && here === cost[i - 1][j - 1] + COST.wrong) {
                marks.unshift({ letter: guess[i - 1], mark: 'wrong' });
                i--;
                j--;
            } else if (i > 0 && here === cost[i - 1][j] + COST.extra) {
                marks.unshift({ letter: guess[i - 1], mark: 'extra' });
                i--;
            } else {
                marks.unshift({ letter: '', mark: 'missing' });
                j--;
            }
        }
        return goldForSpares(marks, word);
    }

    // Wordle's way: each letter is right, somewhere else in the word, or not in it
    function markWordle(guess, word) {
        const marks = [...guess].map((letter, i) => ({ letter, mark: letter === word[i] ? 'right' : 'wrong' }));
        return goldForSpares(marks, word);
    }

    // A wrong or extra letter is gold if the word needs that letter in another spot that isn't
    // matched yet: in "fhise" for "fish", the h belongs at the end, so it's gold, not crossed out
    function goldForSpares(marks, word) {
        const spare = {};
        [...word].forEach(letter => {
            spare[letter] = (spare[letter] || 0) + 1;
        });
        marks.forEach(({ letter, mark }) => {
            if (mark === 'right' || mark === 'elsewhere') {
                spare[letter]--;
            }
        });
        ['wrong', 'extra'].forEach(kind => marks.forEach(item => {
            if (item.mark === kind && spare[item.letter] > 0) {
                item.mark = 'elsewhere';
                spare[item.letter]--;
            }
        }));
        return marks;
    }

    // ---------- Sounds (little chiptune blips, made on the fly) ----------

    const sound = (function () {
        let audio = null;

        function context() {
            if (!audio) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    return null;
                }
                audio = new AudioContext();
            }
            // iPads only allow sound after a tap, so this gets called from tap handlers
            if (audio.state === 'suspended') {
                audio.resume();
            }
            return audio;
        }

        function tone({ freq, to, dur = 0.12, type = 'square', vol = 0.08, delay = 0 }) {
            const a = !state.muted && context();
            if (!a) {
                return;
            }
            const t = a.currentTime + delay;
            const osc = a.createOscillator();
            const gain = a.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (to) {
                osc.frequency.exponentialRampToValueAtTime(to, t + dur);
            }
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(gain).connect(a.destination);
            osc.start(t);
            osc.stop(t + dur + 0.05);
        }

        return {
            wake: context,
            key() {
                tone({ freq: 520, dur: 0.04, vol: 0.04 });
            },
            // A pick-axe tink for each letter as it's revealed: higher for better
            reveal(mark) {
                const freq = { right: 988, elsewhere: 740, wrong: 330, extra: 262, missing: 392 }[mark];
                tone({ freq, dur: 0.09, type: mark === 'right' || mark === 'elsewhere' ? 'square' : 'triangle', vol: 0.06 });
            },
            miss() {
                tone({ freq: 196, to: 147, dur: 0.18, type: 'triangle', vol: 0.1 });
            },
            win() {
                [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, dur: 0.14, delay: i * 0.1 }));
                tone({ freq: 1319, dur: 0.4, vol: 0.06, delay: 0.42 });
            },
            click() {
                tone({ freq: 660, dur: 0.05, vol: 0.05 });
            },
        };
    })();

    // ---------- Saying words out loud (the iPad's own voice) ----------

    const speech = (function () {
        const synth = window.speechSynthesis;
        if (synth) {
            synth.getVoices(); // starts the list loading
        }

        function voice() {
            const voices = synth.getVoices();
            const american = voices.filter(v => /^en[-_]US/i.test(v.lang));
            return american.find(v => /Samantha|Karen|Moira|Google US English/.test(v.name))
                || american[0] || voices.find(v => /^en/i.test(v.lang)) || null;
        }

        return {
            works: Boolean(synth),
            // Say each line in turn, a little slower than usual
            say(lines) {
                if (!synth) {
                    return;
                }
                synth.cancel();
                const picked = voice();
                lines.forEach(text => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.rate = 0.8;
                    if (picked) {
                        utterance.voice = picked;
                    }
                    synth.speak(utterance);
                });
            },
        };
    })();

    // ---------- The page ----------

    const root = document.getElementById('word-mine');
    root.innerHTML = `
        <header class="wm-bar">
            <h1 class="wm-title"><span class="wm-gem" aria-hidden="true"></span>Word Mine</h1>
            <div class="wm-modes" role="group" aria-label="Game">
                <button type="button" class="wm-button wm-mode" data-mode="spell">Spelling</button>
                <button type="button" class="wm-button wm-mode" data-mode="mystery">Mystery word</button>
            </div>
            <div class="wm-buttons">
                <button type="button" class="wm-button" data-action="help" aria-label="How to play">?</button>
                <button type="button" class="wm-button wm-sound" data-action="sound"></button>
            </div>
        </header>
        <main class="wm-main">
            <section class="wm-clue"></section>
            <div class="wm-board"></div>
            <p class="wm-message" aria-live="polite"></p>
            <div class="wm-keyboard"></div>
        </main>
        <div class="wm-overlay" hidden>
            <div class="wm-panel" role="dialog" aria-modal="true" aria-labelledby="wm-panel-title"></div>
        </div>
    `;

    const el = {
        title: root.querySelector('.wm-title'),
        modes: root.querySelectorAll('.wm-mode'),
        sound: root.querySelector('.wm-sound'),
        clue: root.querySelector('.wm-clue'),
        board: root.querySelector('.wm-board'),
        message: root.querySelector('.wm-message'),
        keyboard: root.querySelector('.wm-keyboard'),
        overlay: root.querySelector('.wm-overlay'),
        panel: root.querySelector('.wm-panel'),
    };

    function say(text) {
        el.message.innerHTML = escapeHtml(text);
    }

    function updateBar() {
        el.modes.forEach(button => {
            const picked = button.dataset.mode === state.mode;
            button.classList.toggle('wm-mode--picked', picked);
            button.setAttribute('aria-pressed', String(picked));
        });
        el.sound.textContent = state.muted ? '🔇 Sound off' : '🔊 Sound on';
        el.sound.setAttribute('aria-pressed', String(!state.muted));
    }

    // One letter block. Marks: right, elsewhere, wrong, extra, missing; or typed, cursor, empty.
    function tile(letter, mark) {
        const label = { right: 'right', elsewhere: 'goes somewhere else', wrong: 'not in the word', extra: 'extra letter', missing: 'missing letter' }[mark];
        return `<span class="wm-tile wm-tile--${mark}"${label ? ` aria-label="${letter ? letter + ', ' : ''}${label}"` : ''}>${escapeHtml(letter || (mark === 'missing' ? '?' : ''))}</span>`;
    }

    function rowHtml(marks, extraClass = '') {
        return `<div class="wm-row ${extraClass}">${marks.map(({ letter, mark }) => tile(letter, mark)).join('')}</div>`;
    }

    // ---------- Picking words ----------

    function pickSpellingWord() {
        // A word he missed earlier, if one is due back
        const due = state.review.findIndex(item => item.due <= state.spelled);
        if (due >= 0) {
            const [item] = state.review.splice(due, 1);
            return ALL_WORDS.get(item.word);
        }
        // Mostly this level's words, with some from earlier levels mixed in to keep them fresh
        const current = LEVELS[state.level - 1].words;
        const earlier = LEVELS.slice(0, state.level - 1).flatMap(level => level.words);
        const pool = earlier.length && Math.random() < 0.25 ? earlier : current;
        const fresh = pool.filter(([word]) => !state.recent.includes(word));
        return randomItem(fresh.length ? fresh : pool);
    }

    function pickMysteryWord() {
        const fresh = WORDS.mystery.filter(([word]) => !state.recentMystery.includes(word));
        return randomItem(fresh.length ? fresh : WORDS.mystery);
    }

    // ---------- Playing a word ----------

    function newRound() {
        hidePanel();
        if (state.mode === 'spell') {
            const [word, sentence, tip] = pickSpellingWord();
            remember(state.recent, word, 25);
            state.round = { mode: 'spell', word, sentence, tip, rows: [], typed: '', misses: 0, peeks: 0, shown: false, keys: {} };
            say('Listen, then spell the word!');
            speakWord();
        } else {
            const [word, kind] = pickMysteryWord();
            remember(state.recentMystery, word, 50);
            state.round = { mode: 'mystery', word, clue: CLUES[kind], rows: [], typed: '', misses: 0, hinted: [], keys: {} };
            say('Guess the mystery word! It has 5 letters.');
        }
        saveProgress();
        renderClue();
        renderBoard();
        renderKeyboard();
        fitBoard();
    }

    function speakWord() {
        const r = state.round;
        speech.say([r.word, r.sentence, r.word]);
    }

    // The sentence, with the word blanked out (always the same width, so it doesn't give away
    // the length) unless it's being peeked at or has been shown
    function sentenceHtml(r, showWord) {
        const pattern = new RegExp('\\b' + r.word + '\\b', 'i');
        const [before, after] = r.sentence.split(pattern);
        const used = r.sentence.match(pattern)[0];
        const blank = showWord
            ? `<span class="wm-blank wm-blank--shown">${escapeHtml(used)}</span>`
            : '<span class="wm-blank" aria-label="blank"></span>';
        return escapeHtml(before) + blank + escapeHtml(after);
    }

    function renderClue(peeking = false) {
        const r = state.round;
        if (r.mode === 'spell') {
            const level = LEVELS[state.level - 1];
            el.clue.innerHTML = `
                <p class="wm-level">${escapeHtml('Level ' + state.level + ': ' + level.name)}</p>
                <p class="wm-sentence">${sentenceHtml(r, peeking || r.shown)}</p>
                <div class="wm-clue-buttons">
                    <button type="button" class="wm-button" data-action="hear">🔊 Hear it</button>
                    <button type="button" class="wm-button" data-action="peek"${r.shown ? ' disabled' : ''}>👀 Peek</button>
                </div>
                ${r.misses ? `<p class="wm-tip">${escapeHtml(tipFor(r.tip))}</p>` : ''}
            `;
        } else {
            const known = [...r.word].map((letter, i) => (r.hinted.includes(i) || r.rows.some(row => row[i].mark === 'right'))
                ? { letter, mark: 'right' } : { letter: '', mark: 'missing' });
            el.clue.innerHTML = `
                <p class="wm-level">Mystery word</p>
                <p class="wm-sentence">${escapeHtml(r.clue)}</p>
                <div class="wm-clue-buttons">
                    ${rowHtml(known, 'wm-row--small')}
                    <button type="button" class="wm-button" data-action="hint"${known.filter(k => k.mark === 'missing').length <= 1 || r.hinted.length >= 2 ? ' disabled' : ''}>💡 Hint</button>
                </div>
            `;
        }
    }

    function tipFor(tip) {
        return tip.split('+').map(part => TIPS[part]).join(' ');
    }

    // Past tries, then the one being typed. Only the last few fit, so older ones scroll away.
    function renderBoard() {
        const r = state.round;
        const rows = r.rows.map(marks => rowHtml(marks));
        let typing = [...r.typed].map(letter => ({ letter, mark: 'typed' }));
        if (r.mode === 'spell') {
            if (typing.length < MAX_LETTERS) {
                typing.push({ letter: '', mark: 'cursor' });
            }
        } else {
            while (typing.length < r.word.length) {
                typing.push({ letter: '', mark: 'empty' });
            }
        }
        if (!r.done) {
            rows.push(rowHtml(typing, 'wm-row--typing'));
        }
        // Mystery words get all six rows from the start, like Wordle
        if (r.mode === 'mystery') {
            while (rows.length < MAX_ROWS) {
                rows.push(rowHtml(Array.from({ length: r.word.length }, () => ({ letter: '', mark: 'empty' }))));
            }
        }
        el.board.innerHTML = rows.slice(-MAX_ROWS).join('');
    }

    // Size the letter blocks so six rows (and the longest word) always fit between the clue and
    // the keyboard, whatever the screen and however much the clue card says
    function fitBoard() {
        const columns = state.round && state.round.mode === 'mystery' ? 5 : MAX_LETTERS;
        const height = (el.board.clientHeight - 16 - 8 * (MAX_ROWS - 1)) / MAX_ROWS;
        const width = (el.board.clientWidth - 7 * (columns - 1)) / columns;
        el.board.style.setProperty('--tile', Math.max(30, Math.floor(Math.min(height, width, 64))) + 'px');
    }

    if (window.ResizeObserver) {
        new ResizeObserver(fitBoard).observe(el.board);
    }

    const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const ERASE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-7-7z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>'
        + '<path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

    function renderKeyboard() {
        const keys = state.round.keys;
        const key = letter => `<button type="button" class="wm-key${keys[letter] ? ' wm-key--' + keys[letter] : ''}" data-key="${letter}">${letter}</button>`;
        el.keyboard.innerHTML = KEY_ROWS.map((row, i) => `
            <div class="wm-key-row">
                ${i === 2 ? '<button type="button" class="wm-key wm-key--wide wm-key--check" data-action="check">Check</button>' : ''}
                ${[...row].map(key).join('')}
                ${i === 2 ? '<button type="button" class="wm-key wm-key--wide wm-key--erase" data-action="erase" aria-label="Erase">' + ERASE_ICON + '</button>' : ''}
            </div>`).join('');
    }

    function typeLetter(letter) {
        const r = state.round;
        if (!r || r.done || state.busy) {
            return;
        }
        const longest = r.mode === 'spell' ? MAX_LETTERS : r.word.length;
        if (r.typed.length < longest) {
            r.typed += letter;
            sound.key();
            renderBoard();
        }
    }

    function eraseLetter() {
        const r = state.round;
        if (r && !r.done && !state.busy && r.typed) {
            r.typed = r.typed.slice(0, -1);
            sound.key();
            renderBoard();
        }
    }

    function shakeTyping() {
        const row = el.board.querySelector('.wm-row--typing');
        if (row && !reduceMotion) {
            row.animate([
                { transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' },
                { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' },
            ], { duration: 300 });
        }
    }

    function check() {
        const r = state.round;
        if (!r || r.done || state.busy) {
            return;
        }
        if (!r.typed || (r.mode === 'mystery' && r.typed.length < r.word.length)) {
            say(r.mode === 'mystery' ? 'Fill in all 5 letters first.' : 'Type the word first!');
            shakeTyping();
            return;
        }

        const guess = r.typed;
        const marks = r.mode === 'spell' ? markSpelling(guess, r.word) : markWordle(guess, r.word);
        r.rows.push(marks);
        r.typed = '';
        const right = guess === r.word;
        if (right) {
            r.done = true;
        }

        // Color the keys: emerald beats gold beats stone
        const rank = { wrong: 1, elsewhere: 2, right: 3 };
        marks.forEach(({ letter, mark }) => {
            if (letter) {
                const best = mark === 'right' ? 'right' : r.word.includes(letter) ? 'elsewhere' : 'wrong';
                if (rank[best] > (rank[r.keys[letter]] || 0)) {
                    r.keys[letter] = best;
                }
            }
        });

        // Reveal the new row a letter at a time
        renderBoard();
        const rows = el.board.querySelectorAll('.wm-row:not(.wm-row--typing)');
        const shown = [...rows].filter(row => row.querySelector('.wm-tile:not(.wm-tile--empty)'));
        const tiles = shown[shown.length - 1].querySelectorAll('.wm-tile');
        const step = reduceMotion ? 0 : 140;
        state.busy = true;
        tiles.forEach((node, i) => {
            if (!reduceMotion) {
                node.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }],
                    { duration: 260, delay: i * step, easing: 'ease-out', fill: 'backwards' });
            }
            setTimeout(() => sound.reveal(marks[i].mark), i * step);
        });
        setTimeout(() => {
            state.busy = false;
            renderKeyboard();
            if (right) {
                finishRound(true);
            } else if (r.mode === 'spell') {
                spellingMiss(marks);
            } else {
                mysteryMiss(marks);
            }
        }, tiles.length * step + 300);
    }

    function spellingMiss(marks) {
        const r = state.round;
        r.misses++;
        sound.miss();
        const count = mark => marks.filter(item => item.mark === mark).length;
        const extra = count('extra'), missing = count('missing');
        const parts = [];
        if (extra) {
            parts.push(extra === 1 ? 'One letter is extra.' : extra + ' letters are extra.');
        }
        if (missing) {
            parts.push(missing === 1 ? 'One letter is missing.' : missing + ' letters are missing.');
        }
        if (count('elsewhere')) {
            parts.push('Gold letters go in a different spot.');
        } else if (count('wrong')) {
            parts.push(count('wrong') === 1 ? 'One letter needs fixing.' : 'Some letters need fixing.');
        }
        const note = parts.join(' ');

        if (r.misses >= SHOW_AFTER) {
            // Show the word for good, and have him type it once
            r.shown = true;
            say(`Here it is: "${r.word}". Type it once to finish!`);
            speech.say([r.word]);
        } else if (r.misses === PEEK_AFTER) {
            say('Not quite. ' + note + ' Here\'s a peek!');
            renderClue();
            peek(false);
            return;
        } else {
            say((r.misses === 1 ? 'Not quite. ' : '') + note + (r.misses > 1 ? ' Tap Peek if you need to look.' : ''));
        }
        renderClue();
    }

    function mysteryMiss(marks) {
        const r = state.round;
        r.misses++;
        if (r.rows.length >= MAX_ROWS) {
            finishRound(false);
            return;
        }
        sound.miss();
        const has = mark => marks.some(item => item.mark === mark);
        const left = MAX_ROWS - r.rows.length;
        const note = has('right') ? 'Emerald letters are in the right spot!'
            : has('elsewhere') ? 'Gold letters are in the word, but in a different spot.'
                : 'None of those letters are in the word. That helps too!';
        say(note + ` ${left} ${left === 1 ? 'try' : 'tries'} left.`);
        renderClue();
    }

    // Flash the word in the sentence for a moment (look, cover, spell, check)
    function peek(counts = true) {
        const r = state.round;
        if (!r || r.mode !== 'spell' || r.shown || r.peeking) {
            return;
        }
        if (counts) {
            r.peeks++;
        }
        r.peeking = true;
        renderClue(true);
        setTimeout(() => {
            r.peeking = false;
            if (state.round === r) {
                renderClue();
            }
        }, 2200);
    }

    // Mystery word: show one more letter in its spot (at most 2, and never the last one)
    function hint() {
        const r = state.round;
        if (!r || r.mode !== 'mystery' || r.done) {
            return;
        }
        const unknown = [...r.word].map((_, i) => i)
            .filter(i => !r.hinted.includes(i) && !r.rows.some(row => row[i].mark === 'right'));
        if (unknown.length > 1 && r.hinted.length < 2) {
            r.hinted.push(randomItem(unknown));
            say('There\'s a mystery letter for you!');
            renderClue();
        }
    }

    // ---------- Finishing a word ----------

    // Move up a level after 4 words right on the first try in a row, and down one after 2 in a
    // row that took 4 or more tries. Returns 'up', 'down' or nothing.
    function recordSpelling(firstTry, tough) {
        state.spelled++;
        if (firstTry) {
            state.firstTry++;
            state.streak++;
            state.tough = 0;
            if (state.streak >= UP_AFTER && state.level < LEVELS.length) {
                state.level++;
                state.streak = 0;
                return 'up';
            }
            return null;
        }
        state.streak = 0;
        state.tough = tough ? state.tough + 1 : 0;
        if (state.tough >= DOWN_AFTER && state.level > 1) {
            state.level--;
            state.tough = 0;
            return 'down';
        }
        return null;
    }

    function cheer() {
        return withName(randomItem([
            'Awesome spelling{, name}!',
            'You got it{, name}!',
            'Super speller{, name}!',
            'High five{, name}!',
            'You are a word miner{, name}!',
            'Wow, great job{, name}!',
        ]));
    }

    function finishRound(found) {
        const r = state.round;
        r.done = true;
        const tries = r.rows.length;
        const word = rowHtml([...r.word].map(letter => ({ letter, mark: found ? 'right' : 'elsewhere' })), 'wm-row--big');

        if (r.mode === 'spell') {
            const firstTry = tries === 1 && r.peeks === 0;
            const change = recordSpelling(firstTry, r.misses >= 3);
            if (r.misses) {
                // Bring it back a few words from now, and let grown-ups see it was tricky
                state.review = state.review.filter(item => item.word !== r.word);
                state.review.push({ word: r.word, due: state.spelled + 3 });
                if (r.misses >= 2) {
                    state.tricky = state.tricky.filter(w => w !== r.word);
                    remember(state.tricky, r.word, 10);
                }
            }
            const how = r.shown ? 'Now you know it! It will come back soon so you can practice.'
                : firstTry ? 'First try!'
                    : `You got it in ${tries} tries.`;
            const level = LEVELS[state.level - 1].name;
            const news = change === 'up' ? `Level up! Next: ${level}.`
                : change === 'down' ? `Let's practice ${level} for a bit.` : '';
            celebrate();
            showPanel(`
                <h2 id="wm-panel-title" class="wm-panel-title">${r.shown ? 'You did it!' : 'You spelled it!'}</h2>
                ${word}
                <p class="wm-big">${escapeHtml(cheer())}</p>
                <p class="wm-note">${escapeHtml(how)}</p>
                ${news ? `<p class="wm-news">${escapeHtml(news)}</p>` : ''}
                <button type="button" class="wm-button wm-go" data-action="next">Next word</button>
            `);
        } else if (found) {
            state.found++;
            celebrate();
            showPanel(`
                <h2 id="wm-panel-title" class="wm-panel-title">You found it!</h2>
                ${word}
                <p class="wm-big">${escapeHtml(cheer())}</p>
                <p class="wm-note">${escapeHtml(tries === 1 ? 'On your first guess. Amazing!' : `You found it in ${tries} tries.`)}</p>
                <button type="button" class="wm-button wm-go" data-action="next">Next word</button>
            `);
        } else {
            sound.miss();
            showPanel(`
                <h2 id="wm-panel-title" class="wm-panel-title">The word was</h2>
                ${word}
                <p class="wm-big">${escapeHtml(withName('That was a tricky one{, name}!'))}</p>
                <p class="wm-note">Want to try another?</p>
                <button type="button" class="wm-button wm-go" data-action="next">Next word</button>
            `);
        }
        saveProgress();
    }

    function celebrate() {
        sound.win();
        if (reduceMotion) {
            return;
        }
        // Gems and gold
        const colors = ['#2fc26b', '#63e091', '#ffc53d', '#ffe07a', '#5ce1e6', '#a58cff', '#7b5cff'];
        for (let i = 0; i < 60; i++) {
            const bit = document.createElement('span');
            bit.className = 'wm-confetti';
            bit.style.left = Math.random() * 100 + 'vw';
            bit.style.background = randomItem(colors);
            root.append(bit);
            const drift = (Math.random() - 0.5) * 200;
            bit.animate([
                { transform: 'translate(0, -10vh) rotate(0)' },
                { transform: `translate(${drift}px, 110vh) rotate(${180 + Math.random() * 540}deg)` },
            ], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 400, easing: 'ease-in' })
                .finished.then(() => bit.remove());
        }
    }

    // ---------- Panels ----------

    function showPanel(html) {
        el.panel.innerHTML = html;
        el.overlay.hidden = false;
        // Focus the big button rather than the name box, which would pop up the iPad keyboard
        const go = el.panel.querySelector('.wm-go');
        if (go) {
            go.focus();
        }
    }

    function hidePanel() {
        el.overlay.hidden = true;
    }

    function legendHtml() {
        const line = (marks, text) => `<div class="wm-legend-line">${rowHtml(marks, 'wm-row--small')}<span>${text}</span></div>`;
        return `
            <div class="wm-legend">
                ${line([{ letter: 'a', mark: 'right' }], 'Right letter in the right spot')}
                ${line([{ letter: 'a', mark: 'elsewhere' }], 'In the word, but in a different spot')}
                ${line([{ letter: 'a', mark: 'wrong' }], 'Not in the word')}
                ${line([{ letter: 'a', mark: 'extra' }], 'Extra letter: take it out')}
                ${line([{ letter: '', mark: 'missing' }], 'A letter is missing here')}
            </div>`;
    }

    function showStart() {
        const firstTime = !state.started;
        showPanel(firstTime ? `
            <h2 id="wm-panel-title" class="wm-panel-title">Word Mine</h2>
            <p class="wm-big">Dig up words by spelling them!</p>
            <label class="wm-name">
                <span>What's your name?</span>
                <input type="text" maxlength="16" autocomplete="off" value="${escapeHtml(state.name)}">
            </label>
            ${legendHtml()}
            <button type="button" class="wm-button wm-go" data-action="start">Let's go!</button>
        ` : `
            <h2 id="wm-panel-title" class="wm-panel-title">${escapeHtml(withName('Welcome back{, name}!'))}</h2>
            <p class="wm-big">Ready to dig up some words?</p>
            <button type="button" class="wm-button wm-go" data-action="start">Let's go!</button>
        `);
    }

    function showHelp() {
        showPanel(`
            <h2 id="wm-panel-title" class="wm-panel-title">How to play</h2>
            <p class="wm-note"><b>Spelling:</b> listen to the word, spell it, then tap Check.
                If the word is <b>went</b> and you spell <b>whent</b>:</p>
            ${rowHtml(markSpelling('whent', 'went'), 'wm-row--small')}
            <p class="wm-note">If the word is <b>kite</b> and you spell <b>kit</b>:</p>
            ${rowHtml(markSpelling('kit', 'kite'), 'wm-row--small')}
            <p class="wm-note"><b>Mystery word:</b> use the clue to guess a 5-letter word. You get 6 tries!</p>
            ${legendHtml()}
            <button type="button" class="wm-button wm-go" data-action="close">Got it!</button>
        `);
    }

    // ---------- Grown-ups: hold down the "Word Mine" title for 2 seconds ----------

    function showGrownUps() {
        const options = LEVELS.map((level, i) => {
            const picked = i + 1 === state.level;
            return `
                <button type="button" class="wm-level-option${picked ? ' wm-level-option--picked' : ''}" data-action="level" data-level="${i + 1}" aria-pressed="${picked}">
                    <span>${escapeHtml((i + 1) + '. ' + level.name)}</span>
                    <span class="wm-level-example">${escapeHtml(level.about)}</span>
                </button>`;
        }).join('');
        const tricky = state.tricky.length ? state.tricky.slice().reverse().join(', ') : 'none yet';
        showPanel(`
            <h2 id="wm-panel-title" class="wm-panel-title">Grown-ups</h2>
            <p class="wm-note">${escapeHtml(`Spelling words come in levels by spelling pattern, with earlier levels mixed in. ` +
                `It moves up a level after ${UP_AFTER} words right on the first try in a row, and back down after ` +
                `${DOWN_AFTER} in a row that took 4 or more tries. Pick a level to jump to it.`)}</p>
            <div class="wm-level-options">${options}</div>
            <p class="wm-note">${escapeHtml(`Words spelled: ${state.spelled} (${state.firstTry} on the first try). Mystery words found: ${state.found}.`)}</p>
            <p class="wm-note"><b>Tricky words lately:</b> ${escapeHtml(tricky)}</p>
            <button type="button" class="wm-button wm-go" data-action="close">Done</button>
        `);
    }

    function setLevel(level) {
        Object.assign(state, { level, streak: 0, tough: 0, levelPicked: true });
        saveProgress();
        el.panel.querySelectorAll('[data-level]').forEach(option => {
            const picked = Number(option.dataset.level) === level;
            option.classList.toggle('wm-level-option--picked', picked);
            option.setAttribute('aria-pressed', String(picked));
        });
    }

    let holdTimer = null;
    el.title.addEventListener('pointerdown', () => {
        clearTimeout(holdTimer);
        holdTimer = setTimeout(showGrownUps, 2000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
        el.title.addEventListener(type, () => clearTimeout(holdTimer));
    });

    // ---------- Taps and keys ----------

    root.addEventListener('click', ev => {
        const key = ev.target.closest('[data-key]');
        if (key) {
            sound.wake();
            typeLetter(key.dataset.key);
            return;
        }

        const mode = ev.target.closest('[data-mode]');
        if (mode) {
            sound.wake();
            sound.click();
            if (mode.dataset.mode !== state.mode && !state.busy) {
                state.mode = mode.dataset.mode;
                updateBar();
                newRound();
            }
            return;
        }

        const action = ev.target.closest('[data-action]');
        if (!action || action.disabled) {
            return;
        }
        sound.wake();
        switch (action.dataset.action) {
            case 'check':
                check();
                break;
            case 'erase':
                eraseLetter();
                break;
            case 'hear':
                sound.click();
                speakWord();
                break;
            case 'peek':
                sound.click();
                peek();
                break;
            case 'hint':
                sound.click();
                hint();
                break;
            case 'sound':
                state.muted = !state.muted;
                saveProgress();
                updateBar();
                sound.click();
                break;
            case 'help':
                sound.click();
                showHelp();
                break;
            case 'start': {
                sound.click();
                const input = el.panel.querySelector('input');
                if (input) {
                    state.name = input.value.trim().slice(0, 16);
                }
                state.started = true;
                newRound();
                break;
            }
            case 'next':
                sound.click();
                newRound();
                break;
            case 'level':
                sound.click();
                setLevel(Number(action.dataset.level));
                break;
            case 'close':
                sound.click();
                hidePanel();
                // A level picked on the grown-ups panel starts with a new word from it
                if (state.levelPicked) {
                    state.levelPicked = false;
                    if (state.mode === 'spell') {
                        newRound();
                    }
                }
                break;
        }
    });

    // A keyboard works too: letters, Backspace and Enter
    document.addEventListener('keydown', ev => {
        if (!el.overlay.hidden) {
            if (ev.key === 'Enter' && ev.target.matches('.wm-panel input')) {
                el.panel.querySelector('[data-action="start"]').click();
            }
            return;
        }
        if (ev.metaKey || ev.ctrlKey || ev.altKey) {
            return;
        }
        if (/^[a-z]$/i.test(ev.key)) {
            typeLetter(ev.key.toLowerCase());
        } else if (ev.key === 'Backspace') {
            eraseLetter();
        } else if (ev.key === 'Enter') {
            check();
        } else {
            return;
        }
        ev.preventDefault();
    });

    // ---------- Off we go ----------

    // A word to show behind the first panel; "Let's go!" picks a fresh one and says it out loud
    // (an iPad only lets a page talk after a tap)
    updateBar();
    state.round = {
        mode: state.mode, word: 'words', sentence: 'Dig up some words!', tip: 'short', clue: 'Dig up some words!',
        rows: [], typed: '', misses: 0, peeks: 0, hinted: [], keys: {},
    };
    renderClue();
    renderBoard();
    renderKeyboard();
    showStart();

    // For poking at in the browser console (and the tests)
    window.WordMine = { markSpelling, markWordle, LEVELS, TIPS, newRound, word: () => state.round && state.round.word };
})();
