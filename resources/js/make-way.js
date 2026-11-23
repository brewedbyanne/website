/*
 * Make Way! A traffic-jam puzzle for kids (opened from the video game theme).
 *
 * The board is full of cars (or trains, ducks or mine carts), each pointing one way.
 * Tap one and it drives off the board, unless something is in its way, in which case it
 * goes BONK, rolls back and costs a heart. Running out of hearts is never a game over: the
 * board waits while a math problem fills them back up (grown-ups set the math level by
 * holding down the title). Clear every ride to finish the level. Levels are generated,
 * and grow slowly.
 *
 * A puzzle like this can never get stuck: driving a ride off only frees up space, so
 * any ride with a clear road is always a good move. The generator only has to make sure
 * no rides block each other in a circle, and it checks every board before using it.
 */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DIRS = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
    const ART = 16; // art pixels per board square

    // ---------- The rides ----------

    const COLORS = [
        ['red', '#e53935'], ['blue', '#1e88e5'], ['yellow', '#fdd835'], ['green', '#43a047'],
        ['orange', '#fb8c00'], ['purple', '#8e24aa'], ['teal', '#00acc1'], ['pink', '#f06292'],
    ];

    const RIDES = {
        cars: {
            label: 'Cars',
            noun: 'car',
            shout: 'Vroom!',
            skill: 'driving',
            way: 'road',
            resume: 'Start your engines{, name}!',
            board: 'road',
            tutorial: 'Tap a car to drive it off the road. If another car is in the way, it goes BONK and costs a heart!',
            empty: 'Out of gas!',
            refill: 'Solve this to fill up the tank:',
            full: 'Tank\'s full! Vroom!',
            bumps: ['Beep beep! Something is in the way.', 'Honk honk! That road is blocked.', 'Bonk! Try a different car.'],
        },
        trains: {
            label: 'Trains',
            noun: 'train',
            shout: 'Choo choo!',
            skill: 'train driving',
            way: 'track',
            resume: 'All aboard{, name}!',
            board: 'grass',
            tutorial: 'Tap a train to send it down the tracks. If something is in the way, it goes BONK and costs a heart!',
            empty: 'Out of steam!',
            refill: 'Solve this to get the steam going:',
            full: 'Full steam ahead!',
            bumps: ['Toot toot! Something is in the way.', 'Bonk! That track is blocked.', 'Oops! Try a different train.'],
        },
        ducks: {
            label: 'Ducks',
            noun: 'duck family',
            shout: 'Quack!',
            skill: 'duck herding',
            way: 'path',
            resume: 'Waddle on{, name}!',
            board: 'pond',
            tutorial: 'Tap a mama duck to lead her ducklings away. If someone is in the way, they go BONK and it costs a heart!',
            empty: 'The ducks are tired!',
            refill: 'Solve this to give them a snack:',
            full: 'Yum! Back to waddling!',
            bumps: ['Quack! Someone is in the way.', 'Bonk! Those ducks are blocked.', 'Oops! Try a different duck family.'],
        },
        carts: {
            label: 'Mine Carts',
            noun: 'mine cart',
            shout: 'Clank clank!',
            skill: 'mining',
            way: 'tunnel',
            resume: 'Hard hats on{, name}!',
            board: 'stone',
            tutorial: 'Tap a mine cart to roll it out of the mine. If something is in the way, it goes BONK and costs a heart!',
            empty: 'The drill ran out of power!',
            refill: 'Solve this to power it back up:',
            full: 'Drill powered up!',
            bumps: ['Clunk! Something is in the way.', 'Bonk! That tunnel is blocked.', 'Oops! Try a different cart.'],
        },
    };

    // ---------- Math problems (they refill the hearts) ----------
    //
    // Each bonk costs a heart. When they're all gone, the board waits while a math problem fills
    // them back up, so running out is a math break rather than losing. Multiplication shows up as
    // equal groups written as repeated adding (4 + 4 + 4), which is how first graders meet it.

    const MAX_HEARTS = 3;

    const MATH_LEVELS = [
        { name: 'Adding to 10', example: '3 + 4' },
        { name: 'Adding and subtracting to 10', example: '9 - 3' },
        { name: 'Adding to 20', example: '8 + 7' },
        { name: 'Adding and subtracting to 20', example: '15 - 6' },
        { name: 'To 20, plus equal groups', example: '4 + 4 + 4' },
        { name: 'Bigger numbers and bigger groups', example: '34 + 5' },
    ];

    // Where a first grader who's ahead would start. Grown-ups can change it.
    const DEFAULT_MATH_LEVEL = 4;

    // The two numbers make a sum between low and high
    function adding(low, high) {
        const sum = randomInt(low, high);
        const a = randomInt(1, sum - 1);
        return { text: a + ' + ' + (sum - a), answer: sum, blocks: { add: [a, sum - a] } };
    }

    // Start from a number between low and high and take some away (never all of it)
    function subtracting(low, high) {
        const a = randomInt(low, high);
        const b = randomInt(1, a - 1);
        return { text: a + ' - ' + b, answer: a - b, blocks: { take: [a, b] } };
    }

    function equalGroups(mostGroups, biggestGroup) {
        const count = randomInt(2, mostGroups), size = randomInt(2, biggestGroup);
        return {
            text: Array(count).fill(size).join(' + '),
            caption: count + ' groups of ' + size,
            answer: count * size,
            blocks: { groups: [count, size] },
        };
    }

    // A two-digit number and a one-digit number, with no carrying or borrowing (34 + 5, 47 - 3).
    // Too many to count on blocks, so the hint shows how to do it with just the ones.
    function biggerNumbers() {
        const tens = randomInt(1, 9) * 10;
        if (Math.random() < 0.5) {
            const ones = randomInt(0, 8), b = randomInt(1, 9 - ones);
            return {
                text: (tens + ones) + ' + ' + b,
                answer: tens + ones + b,
                hint: `${ones} + ${b} = ${ones + b}, so it's ${tens} + ${ones + b}.`,
            };
        }
        const ones = randomInt(1, 9), b = randomInt(1, ones);
        return {
            text: (tens + ones) + ' - ' + b,
            answer: tens + ones - b,
            hint: `${ones} - ${b} = ${ones - b}, so it's ${tens} + ${ones - b}.`,
        };
    }

    function mathProblem(level) {
        const roll = Math.random();
        switch (level) {
            case 1: return adding(3, 10);
            case 2: return roll < 0.5 ? adding(3, 10) : subtracting(3, 10);
            case 3: return adding(8, 20);
            case 4: return roll < 0.5 ? adding(8, 20) : subtracting(8, 20);
            case 5: return roll < 0.35 ? equalGroups(4, 5) : roll < 0.7 ? adding(8, 20) : subtracting(8, 20);
            default: return roll < 0.35 ? equalGroups(5, 5) : biggerNumbers();
        }
    }

    // ---------- Saved progress (kept on this device only) ----------
    //
    // Progress is one object in localStorage under makeWay.save, with a version number. When a
    // change to the game needs the save to change shape, bump SAVE_VERSION and add a step to
    // UPGRADES that turns the old shape into the new one. (A brand-new field with a sensible
    // default, like math, doesn't need that.) Before a save is upgraded, a copy of it is put
    // aside under makeWay.backup.v<old version> and never written again, so a bad upgrade can
    // be repaired by a later one. Nothing here ever deletes anything.

    const SAVE_KEY = 'makeWay.save';
    const SAVE_VERSION = 2;

    // Each step turns a save of version n into version n + 1
    const UPGRADES = {
        // Version 1 kept each setting under its own key (see readFirstSave). Those keys stay where
        // they are, and get read again if makeWay.save is ever missing or damaged.
        1: save => save,
    };

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

    // Version 1 saved makeWay.level, makeWay.ride and so on separately
    function readFirstSave() {
        let save = null;
        ['level', 'ride', 'name', 'muted', 'started'].forEach(field => {
            const value = parse(storageGet('makeWay.' + field));
            if (value !== null) {
                save = save || { version: 1 };
                save[field] = value;
            }
        });
        return save;
    }

    function loadSave() {
        let save = parse(storageGet(SAVE_KEY));
        if (!save || typeof save !== 'object' || Array.isArray(save)) {
            // Nothing saved yet means a new player
            save = readFirstSave() || { version: SAVE_VERSION };
        }
        if (!Number.isInteger(save.version) || save.version < 1) {
            save.version = 1;
        }
        if (save.version < SAVE_VERSION) {
            while (save.version < SAVE_VERSION) {
                const backupKey = 'makeWay.backup.v' + save.version;
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
    const savedMath = saved.math && typeof saved.math === 'object' ? saved.math : {};
    const isCount = n => Number.isInteger(n) && n >= 0;

    // Only take values from the save that make sense, so a damaged save can't break the game
    const state = {
        level: Number.isInteger(saved.level) && saved.level >= 1 ? saved.level : 1,
        ride: Object.keys(RIDES).includes(saved.ride) ? saved.ride : 'cars',
        name: typeof saved.name === 'string' ? saved.name.slice(0, 16) : '',
        muted: saved.muted === true,
        started: saved.started === true,
        math: {
            level: Number.isInteger(savedMath.level) && savedMath.level >= 1 && savedMath.level <= MATH_LEVELS.length
                ? savedMath.level : DEFAULT_MATH_LEVEL,
            streak: isCount(savedMath.streak) ? savedMath.streak : 0, // right on the first try, in a row
            tough: isCount(savedMath.tough) ? savedMath.tough : 0, // took 3 or more tries, in a row
            solved: isCount(savedMath.solved) ? savedMath.solved : 0,
        },
        // The board size step (see levelConfig) of the last level finished, and of this one
        boardStep: isCount(saved.boardStep) ? saved.boardStep : 0,
        step: 0,
        hearts: MAX_HEARTS,
        bonks: 0, // this level
        problem: null, // the math problem on screen
        cols: 0,
        rows: 0,
        pieces: [],
        grid: [],
        driven: 0,
        hintTimer: null,
    };

    // Anything in the save this version of the game doesn't know about (from a newer version, say,
    // if a change ever has to be rolled back) is written back untouched
    function saveProgress() {
        Object.assign(saved, {
            level: state.level,
            ride: state.ride,
            name: state.name,
            muted: state.muted,
            started: state.started,
            math: { ...savedMath, ...state.math },
            boardStep: state.boardStep,
        });
        storageSet(SAVE_KEY, JSON.stringify(saved));
    }

    // Ask the browser to keep the save even if the iPad runs low on space
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => { });
    }

    // ---------- Levels ----------

    // How big each level is. Boards grow slowly, and lie the long way on a sideways screen.
    // From level 21, step counts the rows and columns added to an 8 by 8 board, and maxStep can
    // hold it back (see startLevel).
    function levelConfig(level, landscape, maxStep = Infinity) {
        let cols, rows, count, step = 0;
        if (level <= 2) {
            [cols, rows, count] = [4, 4, 2 + level];
        } else if (level <= 5) {
            [cols, rows, count] = [5, 5, 2 + level];
        } else if (level <= 9) {
            [cols, rows, count] = [6, 6, 1 + level];
        } else if (level <= 14) {
            [cols, rows, count] = [6, 7, 10 + Math.floor((level - 10) / 2)];
        } else if (level <= 20) {
            [cols, rows, count] = [7, 8, 12 + Math.floor((level - 15) / 2)];
        } else {
            // From 8 by 8, the board gains a row or column every 6 levels (about two the long way for
            // every one across, to suit an iPad's shape) until it's 13 by 22 at level 141. Any bigger
            // and the squares would get fiddly to tap. It also gets more crowded up to level 39.
            step = Math.min(20, Math.floor((level - 21) / 6), maxStep);
            cols = Math.min(13, 8 + Math.floor(step / 3));
            rows = 8 + Math.ceil(step * 2 / 3);
            const crowding = Math.min(0.31, 0.24 + (level - 21) * 0.004);
            count = Math.round(cols * rows * crowding);
        }
        if (landscape && rows > cols) {
            [cols, rows] = [rows, cols];
        }
        return { cols, rows, count, step };
    }

    function emptyGrid(cols, rows) {
        return Array.from({ length: rows }, () => Array(cols).fill(null));
    }

    function occupy(grid, piece, value) {
        piece.cells.forEach(([x, y]) => {
            grid[y][x] = value;
        });
    }

    // What's in front of a piece: null if its road to the edge is clear,
    // otherwise the first piece in the way and how many empty squares come before it
    function blockerOf(piece, grid) {
        const [dx, dy] = DIRS[piece.dir];
        let [x, y] = piece.cells[0];
        let gap = 0;
        for (; ;) {
            x += dx;
            y += dy;
            if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) {
                return null;
            }
            if (grid[y][x] && grid[y][x] !== piece) {
                return { piece: grid[y][x], gap };
            }
            gap++;
        }
    }

    // A board is solvable if driving off whichever piece is free, over and over, empties it
    function solvable(cols, rows, pieces) {
        const grid = emptyGrid(cols, rows);
        pieces.forEach(p => occupy(grid, p, p));
        let left = pieces.slice();
        let moved = true;
        while (left.length && moved) {
            moved = false;
            for (const p of left) {
                if (!blockerOf(p, grid)) {
                    occupy(grid, p, null);
                    left = left.filter(q => q !== p);
                    moved = true;
                    break;
                }
            }
        }
        return left.length === 0;
    }

    function randomItem(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    // A random straight piece that fits in the empty squares, or null.
    // cells[0] is the front (the head); the rest trail behind it.
    function randomPiece(cols, rows, grid) {
        const horizontal = Math.random() < 0.5;
        const room = horizontal ? cols : rows;
        const len = Math.min(randomItem([2, 2, 2, 2, 2, 3, 3, 3, 4]), room - 1);
        const dir = horizontal ? randomItem(['left', 'right']) : randomItem(['up', 'down']);
        const [dx, dy] = DIRS[dir];

        let hx, hy;
        if (horizontal) {
            hx = dx > 0 ? randomInt(len - 1, cols - 1) : randomInt(0, cols - len);
            hy = randomInt(0, rows - 1);
        } else {
            hx = randomInt(0, cols - 1);
            hy = dy > 0 ? randomInt(len - 1, rows - 1) : randomInt(0, rows - len);
        }

        const cells = [];
        for (let i = 0; i < len; i++) {
            const x = hx - dx * i, y = hy - dy * i;
            if (grid[y][x]) {
                return null;
            }
            cells.push([x, y]);
        }
        return { dir, cells, len };
    }

    // Build a board with `count` pieces that can all be cleared. On later levels, also
    // make sure only a few pieces are free at the start, so there's some puzzling to do.
    function generateLevel(cols, rows, count, level) {
        const maxFreeAtStart = level <= 2 ? count : Math.max(1, Math.ceil(count / 3));
        let best = null;

        for (let attempt = 0; attempt < 60; attempt++) {
            const grid = emptyGrid(cols, rows);
            const pieces = [];
            for (let tries = 0; pieces.length < count && tries < 600; tries++) {
                const piece = randomPiece(cols, rows, grid);
                if (!piece) {
                    continue;
                }
                pieces.push(piece);
                occupy(grid, piece, piece);
                if (!solvable(cols, rows, pieces)) {
                    pieces.pop();
                    occupy(grid, piece, null);
                }
            }
            const free = pieces.filter(p => !blockerOf(p, grid)).length;
            const score = pieces.length * 10 - Math.max(0, free - maxFreeAtStart);
            if (!best || score > best.score) {
                best = { pieces, score };
            }
            if (pieces.length === count && free <= maxFreeAtStart) {
                break;
            }
        }
        return best.pieces;
    }

    // ---------- Pixel art (drawn facing right, then turned to face the piece's direction) ----------

    function shade(hex, amount) {
        const n = parseInt(hex.slice(1), 16);
        const channel = shift => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
        return '#' + [16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('');
    }

    function painter(ctx) {
        return {
            rect(x, y, w, h, color) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, w, h);
            },
            clear(x, y, w = 1, h = 1) {
                ctx.clearRect(x, y, w, h);
            },
            // A pixel-perfect filled ellipse
            ellipse(cx, cy, rx, ry, color) {
                ctx.fillStyle = color;
                for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
                    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
                        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
                        if (nx * nx + ny * ny <= 1) {
                            ctx.fillRect(x, y, 1, 1);
                        }
                    }
                }
            },
        };
    }

    const TIRE = '#262626';
    const GLASS = '#9ad7ff';
    const HEADLIGHT = '#ffe066';
    const TAILLIGHT = '#ff3b30';

    function drawCar(p, len, color) {
        const W = len * ART;
        const dark = shade(color, -70), light = shade(color, 45);

        if (len === 2) {
            [5, W - 10].forEach(x => {
                p.rect(x, 1, 5, 3, TIRE);
                p.rect(x, 12, 5, 3, TIRE);
            });
            p.rect(1, 2, W - 2, 12, dark);
            p.rect(2, 3, W - 4, 10, color);
            p.rect(2, 3, W - 4, 1, light);
            p.rect(5, 4, 3, 8, GLASS); // rear window
            p.rect(8, 4, W - 19, 8, light); // roof
            p.rect(W - 11, 4, 3, 8, GLASS); // windshield
            p.rect(W - 10, 5, 1, 2, '#ffffff');
        } else if (len === 3) {
            // A delivery truck: cab in front, cargo box behind
            [4, 14, W - 10].forEach(x => {
                p.rect(x, 1, 5, 3, TIRE);
                p.rect(x, 12, 5, 3, TIRE);
            });
            p.rect(1, 1, W - 18, 14, '#5a5a5a');
            p.rect(2, 2, W - 20, 12, '#eeeeee');
            for (let x = 5; x < W - 18; x += 4) {
                p.rect(x, 2, 1, 12, '#cfcfcf');
            }
            p.rect(W - 16, 2, 14, 12, dark);
            p.rect(W - 15, 3, 12, 10, color);
            p.rect(W - 15, 3, 12, 1, light);
            p.rect(W - 11, 4, 3, 8, GLASS);
            p.rect(W - 10, 5, 1, 2, '#ffffff');
        } else {
            const fireTruck = color === '#e53935';
            const body = fireTruck ? '#e53935' : '#fbc02d';
            const bodyDark = shade(body, -70);
            [5, 20, W - 12].forEach(x => {
                p.rect(x, 1, 6, 3, TIRE);
                p.rect(x, 12, 6, 3, TIRE);
            });
            p.rect(1, 2, W - 2, 12, bodyDark);
            p.rect(2, 3, W - 4, 10, body);
            if (fireTruck) {
                // The ladder down the middle, and red and blue lights on the cab
                p.rect(4, 5, W - 22, 1, '#d9d9d9');
                p.rect(4, 10, W - 22, 1, '#d9d9d9');
                for (let x = 5; x < W - 18; x += 3) {
                    p.rect(x, 6, 1, 4, '#b0b0b0');
                }
                p.rect(W - 15, 5, 2, 2, '#2979ff');
                p.rect(W - 15, 9, 2, 2, TAILLIGHT);
            } else {
                // A school bus: a dark stripe on each side and roof hatches
                p.rect(2, 3, W - 4, 1, '#3b3b3b');
                p.rect(2, 12, W - 4, 1, '#3b3b3b');
                [12, 30].forEach(x => p.rect(x, 6, 5, 4, shade(body, -35)));
            }
            p.rect(W - 11, 4, 3, 8, GLASS);
            p.rect(W - 10, 5, 1, 2, '#ffffff');
        }

        // Rounded corners, headlights and taillights
        [[1, 2], [W - 2, 2], [1, 13], [W - 2, 13]].forEach(([x, y]) => p.clear(x, y));
        p.rect(W - 3, 3, 2, 2, HEADLIGHT);
        p.rect(W - 3, 11, 2, 2, HEADLIGHT);
        p.rect(1, 3, 2, 2, TAILLIGHT);
        p.rect(1, 11, 2, 2, TAILLIGHT);
    }

    function drawTrain(p, len, color) {
        const wagonColors = [color, shade(color, 40), shade(color, -30)];
        for (let i = 0; i < len - 1; i++) {
            const x = i * ART, c = wagonColors[i % wagonColors.length];
            p.rect(x + 1, 2, 14, 12, shade(c, -70));
            p.rect(x + 2, 3, 12, 10, c);
            for (let px = x + 4; px < x + 14; px += 3) {
                p.rect(px, 3, 1, 10, shade(c, -30)); // roof planks
            }
            p.rect(x, 7, 1, 2, TIRE); // couplings
            p.rect(x + 15, 7, 1, 2, TIRE);
        }

        // The engine: cab at the back, boiler and smokestack in front, cowcatcher on the nose
        const x = (len - 1) * ART;
        p.rect(x, 7, 1, 2, TIRE);
        p.rect(x + 1, 3, 14, 10, '#2b2b2b');
        p.rect(x + 1, 2, 6, 12, shade(color, -70));
        p.rect(x + 2, 3, 4, 10, color);
        p.rect(x + 2, 3, 4, 1, shade(color, 45));
        p.rect(x + 7, 4, 7, 8, '#3d3d3d');
        p.rect(x + 7, 4, 7, 1, '#5c5c5c');
        p.rect(x + 9, 4, 1, 8, color); // a painted band round the boiler
        p.ellipse(x + 12, 8, 2.2, 2.2, '#141414');
        p.ellipse(x + 12, 8, 1.2, 1.2, '#666666');
        p.rect(x + 14, 4, 1, 8, '#c62828');
        p.rect(x + 15, 6, 1, 4, '#c62828');
        p.rect(x + 14, 7, 1, 2, HEADLIGHT);
    }

    function drawDucks(p, len) {
        // Ducklings trail behind
        for (let i = 0; i < len - 1; i++) {
            const x = i * ART;
            p.ellipse(x + 6.5, 8, 4.4, 3.6, '#c99400');
            p.ellipse(x + 6.5, 8, 3.8, 3, '#ffd23f');
            p.ellipse(x + 6, 8, 2, 1.6, '#f2b705'); // tiny wing fluff
            p.ellipse(x + 11, 8, 2.6, 2.6, '#c99400');
            p.ellipse(x + 11, 8, 2, 2, '#ffe066');
            p.rect(x + 13, 7, 2, 2, '#ff8f00');
            p.rect(x + 11, 6, 1, 1, '#1b1b1b');
            p.rect(x + 11, 9, 1, 1, '#1b1b1b');
        }

        // Mama duck leads
        const x = (len - 1) * ART;
        p.ellipse(x + 6.5, 8, 6.4, 5, '#5c3d1e');
        p.ellipse(x + 6.5, 8, 5.8, 4.4, '#a0703c');
        p.ellipse(x + 6, 8, 3.8, 2.6, '#7a5128'); // wings
        p.rect(x, 7, 2, 2, '#5c3d1e'); // tail
        p.ellipse(x + 12, 8, 3.2, 3.2, '#3d2814');
        p.ellipse(x + 12, 8, 2.6, 2.6, '#2e7d32'); // a green head, so the leader stands out
        p.rect(x + 14, 7, 2, 2, '#ff8f00');
        p.rect(x + 12, 6, 1, 1, '#ffffff');
        p.rect(x + 12, 9, 1, 1, '#ffffff');
    }

    const ORES = [
        ['#2b2b2b', '#595959'], // coal
        ['#f5c542', '#fff1a8'], // gold
        ['#5ce1e6', '#c9fbff'], // diamond
        ['#d62828', '#ff8a8a'], // redstone
        ['#3ad16a', '#b6ffcb'], // emerald
    ];

    function drawCarts(p, len) {
        for (let i = 0; i < len - 1; i++) {
            const x = i * ART;
            [3, 10].forEach(wx => {
                p.rect(x + wx, 1, 3, 2, TIRE);
                p.rect(x + wx, 13, 3, 2, TIRE);
            });
            p.rect(x + 1, 2, 14, 12, '#3f3f3f');
            p.rect(x + 2, 3, 12, 10, '#8a8a8a');
            p.rect(x + 2, 3, 12, 1, '#b0b0b0');
            p.rect(x + 3, 4, 10, 8, '#2a2a2a');
            // A load of ore blocks
            [[4, 5], [8, 5], [5, 8], [9, 8]].forEach(([ox, oy]) => {
                const [ore, shine] = randomItem(ORES);
                p.rect(x + ox, oy, 3, 3, ore);
                p.rect(x + ox, oy, 1, 1, shine);
            });
            p.rect(x, 7, 1, 2, TIRE);
            p.rect(x + 15, 7, 1, 2, TIRE);
        }
        // The front cart carries a big drill, so it's obvious which way they'll go
        const x = (len - 1) * ART;
        [2, 7].forEach(wx => {
            p.rect(x + wx, 1, 3, 2, TIRE);
            p.rect(x + wx, 13, 3, 2, TIRE);
        });
        p.rect(x, 7, 1, 2, TIRE);
        p.rect(x + 1, 2, 10, 12, '#3f3f3f');
        p.rect(x + 2, 3, 8, 10, '#ffb300');
        p.rect(x + 2, 3, 8, 1, '#ffd966');
        p.rect(x + 4, 6, 4, 4, '#3f3f3f'); // the motor
        for (let col = 0; col < 5; col++) {
            const top = 3 + col, height = 10 - col * 2;
            p.rect(x + 11 + col, top, 1, height, col % 2 ? '#9e9e9e' : '#d9d9d9');
        }
    }

    const DRAW = { cars: drawCar, trains: drawTrain, ducks: drawDucks, carts: drawCarts };

    // Draw a piece's sprite into a canvas turned to face its direction
    function spriteFor(piece, ride) {
        const W = piece.len * ART, H = ART;
        const vertical = piece.dir === 'up' || piece.dir === 'down';
        const canvas = document.createElement('canvas');
        canvas.width = vertical ? H : W;
        canvas.height = vertical ? W : H;
        const ctx = canvas.getContext('2d');
        if (piece.dir === 'left') {
            ctx.translate(W, H);
            ctx.rotate(Math.PI);
        } else if (piece.dir === 'down') {
            ctx.translate(H, 0);
            ctx.rotate(Math.PI / 2);
        } else if (piece.dir === 'up') {
            ctx.translate(0, W);
            ctx.rotate(-Math.PI / 2);
        }
        DRAW[ride](painter(ctx), piece.len, piece.color);
        return canvas;
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

        function tone({ freq, to, dur = 0.15, type = 'square', vol = 0.1, delay = 0 }) {
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

        function noise({ dur = 0.08, vol = 0.12, delay = 0 }) {
            const a = !state.muted && context();
            if (!a) {
                return;
            }
            const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            }
            const src = a.createBufferSource();
            const gain = a.createGain();
            gain.gain.value = vol;
            src.buffer = buffer;
            src.connect(gain).connect(a.destination);
            src.start(a.currentTime + delay);
        }

        return {
            wake: context,
            go(ride) {
                if (ride === 'cars') {
                    tone({ freq: 110, to: 440, dur: 0.35, type: 'sawtooth', vol: 0.07 });
                } else if (ride === 'trains') {
                    tone({ freq: 587, dur: 0.14 });
                    tone({ freq: 740, dur: 0.2, delay: 0.16 });
                } else if (ride === 'ducks') {
                    tone({ freq: 880, to: 400, dur: 0.11 });
                    tone({ freq: 860, to: 380, dur: 0.11, delay: 0.15 });
                } else {
                    noise({ dur: 0.06 });
                    noise({ dur: 0.06, delay: 0.12 });
                    tone({ freq: 330, to: 220, dur: 0.12, delay: 0.05, vol: 0.06 });
                }
            },
            bump(ride) {
                tone({ freq: 180, to: 90, dur: 0.16, vol: 0.14 });
                if (ride === 'cars') {
                    tone({ freq: 466, dur: 0.09, vol: 0.07, delay: 0.08 });
                    tone({ freq: 466, dur: 0.12, vol: 0.07, delay: 0.22 });
                }
            },
            win() {
                [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, dur: 0.16, delay: i * 0.12 }));
                tone({ freq: 1047, dur: 0.45, vol: 0.08, delay: 0.5 });
            },
            correct() {
                [784, 1047].forEach((freq, i) => tone({ freq, dur: 0.14, delay: i * 0.11 }));
            },
            // A little rising sparkle as the hearts fill back up
            refill() {
                [523, 659, 784].forEach((freq, i) => tone({ freq, dur: 0.1, vol: 0.07, delay: i * 0.15 }));
            },
            click() {
                tone({ freq: 660, dur: 0.05, vol: 0.05 });
            },
        };
    })();

    // ---------- Words ----------

    function withName(text) {
        return text.replace('{, name}', state.name ? ', ' + state.name : '');
    }

    // For putting text (like his name) inside HTML
    function escapeHtml(text) {
        return text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    }

    // Text for inside HTML, with numbers in the blocky font (see write, below)
    function numbers(text) {
        return escapeHtml(String(text)).replace(/\d+/g, '<span class="mw-num">$&</span>');
    }

    function cheer() {
        const ride = RIDES[state.ride];
        return withName(randomItem([
            'Awesome job{, name}!',
            'You did it{, name}!',
            'Super ' + ride.skill + '{, name}!',
            'You are a puzzle pro{, name}!',
            'High five{, name}!',
            'Amazing work{, name}!',
            'Wow, you cleared the whole board{, name}!',
        ]));
    }

    // ---------- The page ----------

    const root = document.getElementById('make-way');
    root.innerHTML = `
        <header class="mw-bar">
            <h1 class="mw-title">Make Way!</h1>
            <div class="mw-status">
                <span class="mw-level"></span>
                <span class="mw-hearts" role="img"></span>
                <span class="mw-trophies"></span>
            </div>
            <div class="mw-buttons">
                <button type="button" class="mw-button" data-action="hint">Hint</button>
                <button type="button" class="mw-button" data-action="ride">Change ride</button>
                <button type="button" class="mw-button mw-sound" data-action="sound"></button>
            </div>
        </header>
        <main class="mw-stage">
            <div class="mw-board"></div>
        </main>
        <p class="mw-message" aria-live="polite"></p>
        <div class="mw-overlay" hidden>
            <div class="mw-panel" role="dialog" aria-modal="true" aria-labelledby="mw-panel-title"></div>
        </div>
    `;

    const el = {
        title: root.querySelector('.mw-title'),
        level: root.querySelector('.mw-level'),
        hearts: root.querySelector('.mw-hearts'),
        trophies: root.querySelector('.mw-trophies'),
        sound: root.querySelector('.mw-sound'),
        stage: root.querySelector('.mw-stage'),
        board: root.querySelector('.mw-board'),
        message: root.querySelector('.mw-message'),
        overlay: root.querySelector('.mw-overlay'),
        panel: root.querySelector('.mw-panel'),
    };

    // Write text into an element, with any numbers in the blocky title font. In the reading
    // font a 2 looks like an 8 and a 5 like an S, which is no good for a level or trophy count.
    function write(node, text) {
        node.replaceChildren(...String(text).split(/(\d+)/).map((part, i) => {
            if (i % 2 === 0) {
                return document.createTextNode(part);
            }
            const number = document.createElement('span');
            number.className = 'mw-num';
            number.textContent = part;
            return number;
        }));
    }

    function say(text) {
        write(el.message, text);
    }

    // A pixel heart: K is the outline, R the inside, W a shine
    const HEART = [
        '.KK...KK.',
        'KRRK.KRRK',
        'KRWRKRRRK',
        'KRRRRRRRK',
        '.KRRRRRK.',
        '..KRRRK..',
        '...KRK...',
        '....K....',
    ];

    function heartSvg(full) {
        const colors = full ? { K: '#1b1b1b', R: '#e53935', W: '#ffffff' } : { K: '#1b1b1b', R: '#7a6656', W: '#7a6656' };
        let pixels = '';
        HEART.forEach((row, y) => [...row].forEach((ch, x) => {
            if (colors[ch]) {
                pixels += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"/>`;
            }
        }));
        return `<svg class="mw-heart" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg>`;
    }

    function updateBar() {
        write(el.level, 'Level ' + state.level);
        el.hearts.innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) => heartSvg(i < state.hearts)).join('');
        el.hearts.setAttribute('aria-label', state.hearts + (state.hearts === 1 ? ' heart' : ' hearts') + ' left');
        const trophies = Math.floor((state.level - 1) / 5);
        write(el.trophies, trophies ? '🏆 × ' + trophies : '');
        el.sound.textContent = state.muted ? '🔇 Sound off' : '🔊 Sound on';
        el.sound.setAttribute('aria-pressed', String(!state.muted));
    }

    // Size the board to fill the screen, whichever way the iPad is turned
    function layout() {
        if (!state.cols) {
            return;
        }
        const barHeight = root.querySelector('.mw-bar').offsetHeight;
        const messageHeight = el.message.offsetHeight;
        const frame = 56; // the grass-and-dirt border plus breathing room
        const width = window.innerWidth - frame;
        const height = window.innerHeight - barHeight - messageHeight - frame;
        const cell = Math.max(28, Math.floor(Math.min(width / state.cols, height / state.rows, 140)));
        el.board.style.setProperty('--cell', cell + 'px');
    }

    window.addEventListener('resize', layout);

    // ---------- Playing ----------

    function cellSize() {
        return parseFloat(getComputedStyle(el.board).getPropertyValue('--cell'));
    }

    function renderPiece(piece) {
        const xs = piece.cells.map(c => c[0]), ys = piece.cells.map(c => c[1]);
        const button = piece.el || document.createElement('button');
        button.type = 'button';
        button.className = 'mw-piece';
        button.style.setProperty('--x', Math.min(...xs));
        button.style.setProperty('--y', Math.min(...ys));
        button.style.setProperty('--w', Math.max(...xs) - Math.min(...xs) + 1);
        button.style.setProperty('--h', Math.max(...ys) - Math.min(...ys) + 1);
        button.setAttribute('aria-label', `${piece.colorName} ${RIDES[state.ride].noun} heading ${piece.dir}`);
        button.replaceChildren(spriteFor(piece, state.ride));
        if (!piece.el) {
            button.addEventListener('click', () => tap(piece));
            piece.el = button;
            el.board.append(button);
        }
    }

    function startLevel() {
        const landscape = window.innerWidth > window.innerHeight;
        // Never more than one row or column bigger than the last board finished. Boards normally
        // grow slower than that anyway; this is for when he's suddenly behind, like when bigger
        // boards arrived in November 2026 and he was already past level 100 on 8 by 8.
        const { cols, rows, count, step } = levelConfig(state.level, landscape, state.boardStep + 1);
        state.step = step;
        state.cols = cols;
        state.rows = rows;
        state.driven = 0;
        state.hearts = MAX_HEARTS;
        state.bonks = 0;
        state.grid = emptyGrid(cols, rows);
        state.pieces = generateLevel(cols, rows, count, state.level);
        state.pieces.forEach(piece => {
            const [colorName, color] = randomItem(COLORS);
            piece.colorName = colorName;
            piece.color = color;
            occupy(state.grid, piece, piece);
        });

        el.board.replaceChildren();
        el.board.style.setProperty('--cols', cols);
        el.board.style.setProperty('--rows', rows);
        el.board.className = 'mw-board mw-board--' + RIDES[state.ride].board;
        state.pieces.forEach(renderPiece);

        updateBar();
        if (state.level === 1) {
            say(RIDES[state.ride].tutorial);
        } else {
            say(withName(randomItem([
                'Level ' + state.level + '! Find one with a clear ' + RIDES[state.ride].way + '.',
                'Ready{, name}? Let\'s clear the board!',
                'Here comes Level ' + state.level + '!',
            ])));
        }
        layout();
        restartHintTimer();
    }

    // Swap every piece's picture when a different ride is picked (the puzzle stays the same)
    function redrawRides() {
        el.board.className = 'mw-board mw-board--' + RIDES[state.ride].board;
        state.pieces.forEach(renderPiece);
    }

    function translate(piece, cells) {
        const [dx, dy] = DIRS[piece.dir];
        const size = cellSize();
        return `translate(${dx * cells * size}px, ${dy * cells * size}px)`;
    }

    function tap(piece) {
        // Out of hearts: the math problem is on its way
        if (piece.moving || state.hearts === 0) {
            return;
        }
        sound.wake();
        clearHint();
        restartHintTimer();

        const block = blockerOf(piece, state.grid);
        if (block) {
            bump(piece, block);
        } else {
            driveOff(piece);
        }
    }

    function bump(piece, block) {
        piece.moving = true;
        state.bonks++;
        const reach = block.gap + 0.25;
        const duration = reduceMotion ? 200 : 260 + block.gap * 70;
        const hit = duration * 0.45;
        piece.el.animate([
            { transform: 'translate(0, 0)' },
            { transform: translate(piece, reach), offset: 0.45, easing: 'ease-out' },
            { transform: translate(piece, reach - 0.2), offset: 0.6 },
            { transform: 'translate(0, 0)' },
        ], { duration, easing: 'ease-in' }).finished.then(() => {
            piece.moving = false;
        });

        setTimeout(() => {
            sound.bump(state.ride);
            if (!reduceMotion) {
                block.piece.el.animate([
                    { transform: 'rotate(0)' }, { transform: 'rotate(-4deg)' },
                    { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' },
                ], { duration: 260 });
            }
            say(randomItem(RIDES[state.ride].bumps));
            loseHeart();
        }, hit);
    }

    function loseHeart() {
        if (state.hearts <= 0) {
            return;
        }
        state.hearts--;
        updateBar();
        if (!reduceMotion) {
            el.hearts.children[state.hearts].animate([
                { transform: 'scale(1.6) rotate(-12deg)' }, { transform: 'scale(1) rotate(0)' },
            ], { duration: 350, easing: 'ease-out' });
        }
        if (state.hearts === 1) {
            say(withName('Careful{, name}! One heart left.'));
        } else if (state.hearts === 0) {
            clearTimeout(state.hintTimer);
            setTimeout(showMathPanel, 700);
        }
    }

    function driveOff(piece) {
        piece.moving = true;
        occupy(state.grid, piece, null);
        sound.go(state.ride);

        // Far enough to get all the way off the board
        const [dx, dy] = DIRS[piece.dir];
        const [hx, hy] = piece.cells[0];
        const toEdge = dx > 0 ? state.cols - hx : dx < 0 ? hx + 1 : dy > 0 ? state.rows - hy : hy + 1;
        const distance = toEdge + piece.len;
        const duration = reduceMotion ? 250 : 300 + distance * 70;

        popWord(piece);
        piece.el.animate([
            { transform: 'translate(0, 0)', opacity: 1 },
            { transform: translate(piece, distance * 0.7), opacity: 1, offset: 0.7 },
            { transform: translate(piece, distance), opacity: 0 },
        ], { duration, easing: 'cubic-bezier(.5, 0, .9, .6)', fill: 'forwards' }).finished.then(() => {
            piece.el.remove();
            state.pieces = state.pieces.filter(p => p !== piece);
            state.driven++;
            if (!state.pieces.length) {
                levelComplete();
            } else if (state.driven % 4 === 0) {
                say(withName(randomItem(['Nice{, name}!', 'Great move!', 'Keep going!', 'You\'re doing great{, name}!'])));
            }
        });
    }

    // "Vroom!" floats up from where a ride leaves the board
    function popWord(piece) {
        if (reduceMotion) {
            return;
        }
        const [hx, hy] = piece.cells[0];
        const word = document.createElement('span');
        word.className = 'mw-pop';
        word.textContent = RIDES[state.ride].shout;
        word.style.setProperty('--x', hx);
        word.style.setProperty('--y', hy);
        el.board.append(word);
        word.animate([
            { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
            { transform: 'translate(-50%, -40%) scale(1.1)', opacity: 1, offset: 0.25 },
            { transform: 'translate(-50%, -140%) scale(1)', opacity: 0 },
        ], { duration: 1000, easing: 'ease-out' }).finished.then(() => word.remove());
    }

    // ---------- Hints: a free ride sparkles if he's been stuck for a little while ----------

    function clearHint() {
        el.board.querySelectorAll('.mw-hint').forEach(node => node.classList.remove('mw-hint'));
    }

    function showHint() {
        const free = state.pieces.filter(p => !p.moving && !blockerOf(p, state.grid));
        if (free.length) {
            clearHint();
            randomItem(free).el.classList.add('mw-hint');
        }
    }

    function restartHintTimer() {
        clearTimeout(state.hintTimer);
        // Big boards take longer to look over, so the sparkle waits longer before giving one away
        state.hintTimer = setTimeout(showHint, state.level <= 20 ? 8000 : 20000);
    }

    // ---------- Finishing a level ----------

    function levelComplete() {
        clearTimeout(state.hintTimer);
        const finished = state.level;
        state.level++;
        state.boardStep = state.step;
        saveProgress();
        sound.win();
        confetti();

        const trophy = finished % 5 === 0;
        const trophies = Math.floor(finished / 5);
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">Level ${finished} complete!</h2>
            <p class="mw-stars" aria-label="3 stars">★ ★ ★</p>
            <p class="mw-big">${escapeHtml(cheer())}</p>
            ${state.bonks === 0 ? '<p class="mw-trophy">Perfect! Not a single bonk!</p>' : ''}
            ${trophy ? `<p class="mw-trophy">🏆 You earned a trophy! That makes <span class="mw-num">${trophies}</span>.</p>` : ''}
            <button type="button" class="mw-button mw-go" data-action="next">Next level</button>
        `);
    }

    function confetti() {
        if (reduceMotion) {
            return;
        }
        const colors = ['#5fae3e', '#866043', '#ffd23f', '#5ce1e6', '#e53935', '#ffffff', '#1e88e5'];
        for (let i = 0; i < 70; i++) {
            const bit = document.createElement('span');
            bit.className = 'mw-confetti';
            bit.style.left = Math.random() * 100 + 'vw';
            bit.style.background = randomItem(colors);
            root.append(bit);
            const drift = (Math.random() - 0.5) * 200;
            bit.animate([
                { transform: 'translate(0, -10vh) rotate(0)' },
                { transform: `translate(${drift}px, 110vh) rotate(${randomInt(180, 720)}deg)` },
            ], { duration: randomInt(1600, 3000), delay: randomInt(0, 400), easing: 'ease-in' })
                .finished.then(() => bit.remove());
        }
    }

    // ---------- Panels: picking a ride, level complete, the math break and grown-ups ----------

    function showPanel(html, kind = '') {
        el.panel.innerHTML = html;
        el.panel.dataset.kind = kind;
        el.overlay.hidden = false;
        // Focus the big button rather than the name box, which would pop up the iPad keyboard
        el.panel.querySelector('.mw-go, .mw-key--ok').focus();
    }

    function hidePanel() {
        el.overlay.hidden = true;
        el.panel.dataset.kind = '';
    }

    // ---------- The math break: out of hearts, so solve a problem to fill them back up ----------

    function showMathPanel() {
        const ride = RIDES[state.ride];
        // Never the same problem twice in a row
        let problem = mathProblem(state.math.level);
        for (let i = 0; i < 5 && state.problem && problem.text === state.problem.text; i++) {
            problem = mathProblem(state.math.level);
        }
        state.problem = { ...problem, typed: '', misses: 0, done: false };

        const key = d => `<button type="button" class="mw-button mw-key" data-digit="${d}">${d}</button>`;
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">${ride.empty}</h2>
            <p class="mw-big">${ride.refill}</p>
            ${problem.caption ? `<p class="mw-caption">${numbers(problem.caption)}</p>` : ''}
            <p class="mw-problem">${problem.text} = <span class="mw-answer"></span></p>
            <div class="mw-blocks" aria-hidden="true" hidden></div>
            <p class="mw-math-message" aria-live="polite"></p>
            <div class="mw-pad">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(key).join('')}
                <button type="button" class="mw-button mw-key mw-key--erase" data-action="erase" aria-label="Erase"></button>
                ${key(0)}
                <button type="button" class="mw-button mw-key mw-key--ok" data-action="check">OK</button>
            </div>
        `, 'math');
        // The first two levels always have blocks to count; the others get them after a wrong answer
        if (state.math.level <= 2) {
            showBlocks();
        }
        showTyped();
    }

    // Blocks to count: two colors for adding, some crossed out for taking away, or equal groups
    function showBlocks() {
        const box = el.panel.querySelector('.mw-blocks');
        const blocks = state.problem.blocks;
        if (!blocks || !box.hidden) {
            return false;
        }
        const group = (count, color = '', crossedOut = 0) =>
            `<span class="mw-group" style="--cols: ${Math.min(5, count)}">` +
            Array.from({ length: count }, (_, i) =>
                `<span class="mw-block ${i >= count - crossedOut ? 'mw-block--gone' : color}"></span>`).join('') +
            '</span>';
        if (blocks.add) {
            box.innerHTML = group(blocks.add[0]) + '<span class="mw-sign">+</span>' + group(blocks.add[1], 'mw-block--gold');
        } else if (blocks.take) {
            box.innerHTML = group(blocks.take[0], '', blocks.take[1]);
        } else {
            const [count, size] = blocks.groups;
            box.innerHTML = Array.from({ length: count }, (_, i) => group(size, i % 2 ? 'mw-block--gold' : '')).join('');
        }
        box.hidden = false;
        return true;
    }

    function showTyped() {
        const answer = el.panel.querySelector('.mw-answer');
        answer.textContent = state.problem.typed || '?';
        answer.classList.toggle('mw-answer--empty', !state.problem.typed);
    }

    function typeDigit(digit) {
        const p = state.problem;
        if (!p.done && p.typed.length < 3) {
            p.typed += digit;
            showTyped();
        }
    }

    function eraseDigit() {
        const p = state.problem;
        if (!p.done) {
            p.typed = p.typed.slice(0, -1);
            showTyped();
        }
    }

    function checkAnswer() {
        const p = state.problem;
        if (p.done || !p.typed) {
            return;
        }
        const message = el.panel.querySelector('.mw-math-message');
        if (Number(p.typed) === p.answer) {
            p.done = true;
            sound.correct();
            write(message, 'Yes! ' + p.answer + ' is right!');
            recordMath(p.misses + 1);
            setTimeout(refillHearts, 1100);
            return;
        }

        // Not quite: blocks to count (or a trick) after the first miss, and the answer after the third
        p.misses++;
        p.typed = '';
        showTyped();
        sound.bump();
        if (!reduceMotion) {
            el.panel.querySelector('.mw-answer').animate([
                { transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' },
                { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' },
            ], { duration: 300 });
        }
        if (p.misses >= 3) {
            write(message, `It's ${p.answer}! Type ${p.answer} to keep going.`);
        } else if (p.misses === 1 && showBlocks()) {
            write(message, 'Not quite. Count the blocks!');
        } else if (p.misses === 1 && p.hint) {
            write(message, 'Not quite. Here\'s a trick: ' + p.hint);
        } else {
            write(message, 'Not quite. Try again!');
        }
    }

    // Move up a math level after 5 right on the first try in a row, and down one after 2 in a row
    // that each took 3 or more tries
    function recordMath(tries) {
        const m = state.math;
        m.solved++;
        if (tries === 1) {
            m.streak++;
            m.tough = 0;
            if (m.streak >= 5 && m.level < MATH_LEVELS.length) {
                m.level++;
                m.streak = 0;
            }
        } else {
            m.streak = 0;
            m.tough = tries >= 3 ? m.tough + 1 : 0;
            if (m.tough >= 2 && m.level > 1) {
                m.level--;
                m.tough = 0;
            }
        }
        saveProgress();
    }

    function refillHearts() {
        hidePanel();
        state.hearts = MAX_HEARTS;
        updateBar();
        sound.refill();
        if (!reduceMotion) {
            [...el.hearts.children].forEach((heart, i) => heart.animate([
                { transform: 'scale(0)' }, { transform: 'scale(1.4)', offset: 0.7 }, { transform: 'scale(1)' },
            ], { duration: 400, delay: i * 150, easing: 'ease-out', fill: 'backwards' }));
        }
        say(withName(RIDES[state.ride].full + ' Keep going{, name}!'));
        restartHintTimer();
    }

    // ---------- Grown-ups: hold down the "Make Way!" title for 2 seconds ----------

    function showGrownUps() {
        clearTimeout(state.hintTimer);
        const options = MATH_LEVELS.map((level, i) => {
            const picked = i + 1 === state.math.level;
            return `
                <button type="button" class="mw-math-level${picked ? ' mw-math-level--picked' : ''}" data-action="math-level" data-level="${i + 1}" aria-pressed="${picked}">
                    <span>${numbers(level.name)}</span>
                    <span class="mw-math-example">${level.example}</span>
                </button>`;
        }).join('');
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">Grown-ups</h2>
            <p class="mw-note">${numbers(`Each bonk costs a heart. When all ${MAX_HEARTS} are gone, a math problem fills them back up. ` +
                'Pick the level the math starts at. It moves up after 5 right answers in a row, and back down after 2 tough ones.')}</p>
            <div class="mw-math-levels">${options}</div>
            <p class="mw-note">${numbers('Math problems solved so far: ' + state.math.solved)}</p>
            <button type="button" class="mw-button mw-go" data-action="close">Done</button>
        `, 'grown-ups');
    }

    function setMathLevel(level) {
        Object.assign(state.math, { level, streak: 0, tough: 0 });
        saveProgress();
        el.panel.querySelectorAll('[data-level]').forEach(option => {
            const picked = Number(option.dataset.level) === level;
            option.classList.toggle('mw-math-level--picked', picked);
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

    // ---------- Picking a ride ----------

    function rideCard(key) {
        const selected = key === state.ride;
        return `
            <button type="button" class="mw-ride${selected ? ' mw-ride--picked' : ''}" data-ride="${key}" aria-pressed="${selected}">
                <span class="mw-ride-art" data-preview="${key}"></span>
                <span class="mw-ride-name">${RIDES[key].label}</span>
            </button>`;
    }

    function showRidePicker(firstTime) {
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">${firstTime ? 'Make Way!' : 'Pick your ride'}</h2>
            ${firstTime ? '<p class="mw-big">Help everyone get out of the traffic jam!</p>' : ''}
            <label class="mw-name">
                <span>What's your name?</span>
                <input type="text" maxlength="16" autocomplete="off" value="${escapeHtml(state.name)}">
            </label>
            <p class="mw-pick">Pick your ride:</p>
            <div class="mw-rides">${Object.keys(RIDES).map(rideCard).join('')}</div>
            <button type="button" class="mw-button mw-go" data-action="start">Let's go!</button>
        `);
        el.panel.querySelectorAll('[data-preview]').forEach(slot => {
            // A plain car is the most car-like car; the others look best three squares long
            const piece = { dir: 'right', len: slot.dataset.preview === 'cars' ? 2 : 3, color: '#e53935' };
            slot.append(spriteFor(piece, slot.dataset.preview));
        });
    }

    el.panel.addEventListener('click', ev => {
        const ride = ev.target.closest('[data-ride]');
        if (ride) {
            sound.click();
            state.ride = ride.dataset.ride;
            el.panel.querySelectorAll('[data-ride]').forEach(card => {
                const picked = card === ride;
                card.classList.toggle('mw-ride--picked', picked);
                card.setAttribute('aria-pressed', String(picked));
            });
            return;
        }

        const digit = ev.target.closest('[data-digit]');
        if (digit) {
            sound.wake();
            sound.click();
            typeDigit(digit.dataset.digit);
            return;
        }

        const action = ev.target.closest('[data-action]');
        if (!action) {
            return;
        }
        sound.wake();
        if (action.dataset.action === 'check') {
            // It makes its own right-or-wrong sound
            checkAnswer();
            return;
        }
        sound.click();
        if (action.dataset.action === 'start') {
            const input = el.panel.querySelector('input');
            state.name = input.value.trim().slice(0, 16);
            state.started = true;
            saveProgress();
            hidePanel();
            redrawRides();
            if (state.level === 1 && !state.driven) {
                say(RIDES[state.ride].tutorial);
            } else {
                say(withName(RIDES[state.ride].resume + ' Keep going.'));
            }
            restartHintTimer();
        } else if (action.dataset.action === 'next') {
            hidePanel();
            startLevel();
        } else if (action.dataset.action === 'erase') {
            eraseDigit();
        } else if (action.dataset.action === 'math-level') {
            setMathLevel(Number(action.dataset.level));
        } else if (action.dataset.action === 'close') {
            hidePanel();
            restartHintTimer();
        }
    });

    // A keyboard works on the math break too: numbers, Backspace and Enter
    document.addEventListener('keydown', ev => {
        if (el.overlay.hidden || el.panel.dataset.kind !== 'math') {
            return;
        }
        if (/^\d$/.test(ev.key)) {
            typeDigit(ev.key);
        } else if (ev.key === 'Backspace') {
            eraseDigit();
        } else if (ev.key === 'Enter') {
            checkAnswer();
        } else {
            return;
        }
        ev.preventDefault();
    });

    // Enter in the name box means "Let's go!"
    el.panel.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' && ev.target.matches('input')) {
            el.panel.querySelector('[data-action="start"]').click();
        }
    });

    root.querySelector('.mw-buttons').addEventListener('click', ev => {
        const action = ev.target.closest('[data-action]');
        if (!action) {
            return;
        }
        sound.wake();
        if (action.dataset.action === 'sound') {
            state.muted = !state.muted;
            saveProgress();
            updateBar();
        } else if (action.dataset.action === 'hint') {
            sound.click();
            showHint();
            restartHintTimer();
        } else if (action.dataset.action === 'ride' && state.hearts > 0) {
            sound.click();
            clearTimeout(state.hintTimer);
            showRidePicker(false);
        }
    });

    // ---------- Off we go ----------

    updateBar();
    startLevel();
    if (!state.started) {
        // The very first time: say hello and pick a ride
        clearTimeout(state.hintTimer);
        showRidePicker(true);
    }

    // For poking at in the browser console (and the tests): build a board without playing it
    window.MakeWay = {
        levelConfig, generateLevel, solvable, blockerOf, emptyGrid, occupy, spriteFor, RIDES,
        mathProblem, MATH_LEVELS, showMathPanel, showGrownUps,
    };
})();
