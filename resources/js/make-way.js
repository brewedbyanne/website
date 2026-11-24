/*
 * Make Way! A traffic-jam puzzle for kids (opened from the games page, games.html).
 *
 * The board is full of cars (or trains, ducks or mine carts), each pointing one way.
 * Tap one and it drives off the board, unless something is in its way, in which case it
 * goes BONK, rolls back and costs a heart. Running out of hearts is never a game over: the
 * board waits while a math problem fills them back up (grown-ups set the math level by
 * holding down the title). Clear every ride to finish the level. Levels are generated,
 * and grow slowly.
 *
 * Every level earns coins, and coins buy new rides in the shop (on the "Change ride" panel).
 * The shop's rides cost a lot on purpose, so there's always something to save up for.
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

        // ---------- The shop: rides with a price have to be bought with coins first ----------

        dragons: {
            label: 'Dragons',
            place: 'Lava Cave',
            about: 'Baby dragons flying out of a lava cave.',
            price: 150,
            noun: 'dragon',
            shout: 'Rawr!',
            skill: 'dragon flying',
            way: 'path',
            resume: 'Wings out{, name}!',
            board: 'lava',
            tutorial: 'Tap a dragon to fly it out of the cave. If another dragon is in the way, it goes BONK and costs a heart!',
            empty: 'The dragons are sleepy!',
            refill: 'Solve this to warm up their fire:',
            full: 'Fire breath ready! Rawr!',
            bumps: ['Rawr! Someone is in the way.', 'Bonk! That path is blocked.', 'Oops! Try a different dragon.'],
        },
        kitties: {
            label: 'Kitties',
            place: 'Kitty Garden',
            about: 'Extra long kitties stretching through a flower garden.',
            price: 200,
            noun: 'kitty',
            shout: 'Meow!',
            skill: 'cat herding',
            way: 'path',
            resume: 'Whiskers ready{, name}!',
            board: 'garden',
            tutorial: 'Tap a kitty to send it out of the garden. If another kitty is in the way, it goes BONK and costs a heart!',
            empty: 'The kitties are napping!',
            refill: 'Solve this to give them a treat:',
            full: 'Purr! Wide awake!',
            bumps: ['Meow! Someone is in the way.', 'Bonk! That path is blocked.', 'Oops! Try a different kitty.'],
        },
        piggies: {
            label: 'Piggies',
            place: 'Piggy Farm',
            about: 'Tractors pulling wagons full of piglets out of the mud.',
            price: 200,
            noun: 'tractor',
            shout: 'Oink!',
            skill: 'farming',
            way: 'lane',
            resume: 'Tractors on{, name}!',
            board: 'farm',
            tutorial: 'Tap a tractor to pull the piglets out of the mud. If something is in the way, it goes BONK and costs a heart!',
            empty: 'The tractors ran out of fuel!',
            refill: 'Solve this to fill them up:',
            full: 'Oink oink! Let\'s go!',
            bumps: ['Oink! Something is in the way.', 'Bonk! That lane is blocked.', 'Oops! Try a different tractor.'],
        },
        popstars: {
            label: 'Pop Stars',
            place: 'Pop Star Stage',
            about: 'Sparkly tour buses on a stage full of spotlights.',
            price: 250,
            noun: 'tour bus',
            shout: 'Encore!',
            skill: 'rock star',
            way: 'road',
            resume: 'Showtime{, name}!',
            board: 'stage',
            tutorial: 'Tap a tour bus to drive the band to the next show. If something is in the way, it goes BONK and costs a heart!',
            empty: 'The band needs a break!',
            refill: 'Solve this to warm up the band:',
            full: 'The crowd goes wild!',
            bumps: ['Oops! Wrong note. Something is in the way.', 'Bonk! That road is blocked.', 'Oops! Try a different tour bus.'],
        },
        fuzzballs: {
            label: 'Fuzzballs',
            place: 'Fuzzball Cave',
            about: 'Round, fuzzy one-eyed monsters and their babies, in a cozy glowing cave.',
            price: 300,
            noun: 'fuzzball family',
            shout: 'Wheee!',
            skill: 'monster wrangling',
            way: 'path',
            resume: 'Roll out, fuzzballs{, name}!',
            board: 'cave',
            tutorial: 'Tap a big fuzzball to lead its babies out of the cave. If someone is in the way, they go BONK and it costs a heart!',
            empty: 'The fuzzballs are sleepy!',
            refill: 'Solve this to wake them up:',
            full: 'Fuzzballs are wide awake! Wheee!',
            bumps: ['Boing! Someone is in the way.', 'Bonk! That path is blocked.', 'Oops! Try a different fuzzball.'],
        },
    };

    // ---------- Coins ----------

    const COINS_PER_LEVEL = 1;
    const COINS_FOR_PERFECT = 1; // no bonks
    const COINS_EVERY_FIFTH = 5; // a bonus on levels 5, 10, 15... (these used to earn a trophy)

    const isForSale = key => Boolean(RIDES[key].price);

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
    const SAVE_VERSION = 3;

    // Each step turns a save of version n into version n + 1
    const UPGRADES = {
        // Version 1 kept each setting under its own key (see readFirstSave). Those keys stay where
        // they are, and get read again if makeWay.save is ever missing or damaged.
        1: save => save,
        // Version 3 swapped trophies (one every 5 levels, counted from the level) for coins.
        // Every trophy already earned turns into the 5 coins those levels earn now.
        2: save => {
            const level = Number.isInteger(save.level) && save.level >= 1 ? save.level : 1;
            return { ...save, coins: COINS_EVERY_FIFTH * Math.floor((level - 1) / 5), owned: [] };
        },
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

    // Rides bought in the shop. Names this version doesn't know (from a newer version, say) are
    // kept, so they're still there if that version comes back.
    const owned = Array.isArray(saved.owned) ? saved.owned.filter(key => typeof key === 'string') : [];
    const canRide = key => Object.prototype.hasOwnProperty.call(RIDES, key) && (!isForSale(key) || owned.includes(key));

    // Only take values from the save that make sense, so a damaged save can't break the game
    const state = {
        level: Number.isInteger(saved.level) && saved.level >= 1 ? saved.level : 1,
        ride: canRide(saved.ride) ? saved.ride : 'cars',
        coins: isCount(saved.coins) ? saved.coins : 0,
        owned,
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
            coins: state.coins,
            owned: state.owned,
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

    // Seen from above: a head with horns in front, wings out to the sides and a pointy tail behind
    function drawDragon(p, len, color) {
        const W = len * ART;
        const dark = shade(color, -80), light = shade(color, 60);
        const wing = shade(color, -35), belly = '#ffe3a3';

        // Wings, one pair per two squares of dragon: widest where they join the body and swept
        // back toward the tail, with a bony edge along the front
        for (let w = 0; w < Math.max(1, Math.floor(len / 2)); w++) {
            const wx = W - 24 - w * 24;
            [[3, -1], [12, 1]].forEach(([join, outward]) => {
                [[0, 10], [1, 8], [2, 6], [3, 3]].forEach(([i, width]) => {
                    const x = wx - i * 2, y = join + outward * i;
                    p.rect(x, y, width, 1, wing);
                    p.rect(x + width - 1, y, 1, 1, dark);
                });
            });
        }

        // The tail, ending in a little spade
        p.rect(3, 7, 4, 2, dark);
        p.rect(0, 6, 3, 4, dark);
        p.rect(1, 7, 1, 2, color);

        // A long body with a row of spikes down the back, pointing toward the tail
        p.rect(6, 4, W - 16, 8, dark);
        p.rect(7, 5, W - 18, 6, color);
        p.rect(7, 5, W - 18, 1, light);
        for (let x = 8; x < W - 12; x += 3) {
            p.rect(x, 7, 1, 2, belly);
            p.rect(x + 1, 6, 1, 4, belly);
        }

        // The head: horns pointing back, two eyes on top and a snout with nostrils
        const hx = W - 10;
        p.rect(hx - 1, 3, 3, 1, '#f5e6c8');
        p.rect(hx - 3, 2, 2, 1, '#f5e6c8');
        p.rect(hx - 1, 12, 3, 1, '#f5e6c8');
        p.rect(hx - 3, 13, 2, 1, '#f5e6c8');
        p.ellipse(hx + 4, 8, 5.2, 5, dark);
        p.ellipse(hx + 4, 8, 4.4, 4.2, color);
        p.rect(hx + 1, 4, 3, 1, light);
        p.rect(hx + 8, 6, 2, 4, color);
        p.rect(hx + 8, 6, 2, 1, dark);
        p.rect(hx + 8, 9, 2, 1, dark);
        [5, 9].forEach(y => {
            p.rect(hx + 3, y, 2, 2, '#ffffff');
            p.rect(hx + 4, y, 1, 2, '#1b1b1b');
        });
        p.rect(W - 1, 7, 1, 2, '#ff8f00'); // a puff of fire on the nose
    }

    // Cat coats, picked by the piece's color so the same color always gets the same cat:
    // [fur, outline, markings, pattern]
    const CATS = {
        red: ['#e8913a', '#8a4a12', '#c0661c', 'tabby'], // orange tabby
        blue: ['#9aa0a6', '#4e5257', '#6f747a', 'tabby'], // gray tabby
        yellow: ['#f3dcae', '#a88a58', '#e2c48c', 'plain'], // cream
        green: ['#33302e', '#111111', '#4a4644', 'plain'], // black
        orange: ['#d9772b', '#7f3d0f', '#f2a865', 'plain'], // ginger
        purple: ['#f4f4f4', '#9a9a9a', '#dadada', 'plain'], // white
        teal: ['#2f2f2f', '#111111', '#f4f4f4', 'tuxedo'], // black with a white chest and paws
        pink: ['#f4f4f4', '#9a9a9a', '#e8913a', 'calico'], // white with orange and black patches
    };

    // An extra long kitty seen from above: pointy ears, whiskers, a curly tail, and a collar
    // and bell in the piece's color, so the colors still tell the pieces apart
    function drawKitty(p, len, color, colorName) {
        const W = len * ART;
        const [fur, dark, mark, pattern] = CATS[colorName] || CATS.red;
        const paws = pattern === 'tuxedo' ? mark : fur;

        // A thin tail, curling up at the end
        p.rect(1, 8, 3, 2, dark);
        p.rect(0, 5, 2, 4, dark);
        p.rect(1, 4, 2, 1, dark);
        p.rect(1, 6, 1, 2, mark === fur ? dark : mark);

        // Four paws poking out the sides
        [5, W - 14].forEach(x => {
            p.rect(x, 2, 3, 2, dark);
            p.rect(x + 1, 2, 1, 1, paws);
            p.rect(x, 12, 3, 2, dark);
            p.rect(x + 1, 13, 1, 1, paws);
        });

        // The long body, with its markings
        p.rect(3, 4, W - 10, 8, dark);
        p.rect(4, 5, W - 12, 6, fur);
        if (pattern === 'tabby') {
            for (let x = 6; x < W - 9; x += 3) {
                p.rect(x, 5, 1, 2, mark);
                p.rect(x, 9, 1, 2, mark);
            }
        } else if (pattern === 'calico') {
            for (let x = 5, i = 0; x < W - 11; x += 5, i++) {
                p.rect(x, i % 2 ? 5 : 8, 3, 3, i % 3 === 1 ? '#33302e' : mark);
            }
        } else if (pattern === 'tuxedo') {
            p.rect(W - 12, 6, 3, 4, mark); // white chest
        }

        // The head, with ears, eyes, a pink nose and whiskers
        const hx = W - 11;
        p.rect(hx - 1, 4, 1, 8, color); // collar
        p.rect(hx - 1, 7, 1, 2, '#ffd23f'); // bell
        p.ellipse(hx + 5, 8, 4.6, 4.4, dark);
        p.ellipse(hx + 5, 8, 3.9, 3.7, fur);
        if (pattern === 'tuxedo') {
            p.rect(hx + 7, 6, 2, 4, mark); // white muzzle
        } else if (pattern === 'tabby') {
            p.rect(hx + 2, 7, 2, 1, mark); // stripes on the forehead
            p.rect(hx + 2, 9, 2, 1, mark);
        } else if (pattern === 'calico') {
            p.rect(hx + 2, 5, 3, 2, '#33302e');
            p.rect(hx + 2, 9, 2, 2, mark);
        }
        // Pointy ears on top of the head, pink inside, leaning back a little
        [[4, -1], [11, 1]].forEach(([y, out]) => {
            p.rect(hx + 1, y, 5, 1, dark);
            p.rect(hx + 1, y + out, 4, 1, dark);
            p.rect(hx + 1, y + out * 2, 2, 1, dark);
            p.rect(hx + 2, y + out, 2, 1, '#ff9eb5');
            p.rect(hx + 2, y, 3, 1, fur);
        });
        [5, 9].forEach(y => {
            p.rect(hx + 6, y, 2, 2, '#a5d64a'); // green eyes with slit pupils
            p.rect(hx + 7, y, 1, 2, '#111111');
        });
        p.rect(W - 2, 7, 1, 2, '#ff8fab'); // nose
        // Whiskers, fanning out from the nose
        const whisker = pattern === 'plain' && fur === '#f4f4f4' ? '#9a9a9a' : '#f4f4f4';
        [[6, -1], [9, 1]].forEach(([y, out]) => {
            p.rect(W - 3, y, 1, 1, whisker);
            p.rect(W - 2, y + out, 1, 1, whisker);
            p.rect(W - 1, y + out * 2, 1, 1, whisker);
        });
    }

    const PIG = '#ffb3c6', PIG_DARK = '#d9708f', SNOUT = '#ff8fab';

    // A tractor in the piece's color, pulling a wagon with a piglet in it for every other square
    function drawPiggies(p, len, color) {
        for (let i = 0; i < len - 1; i++) {
            const x = i * ART;
            [3, 10].forEach(wx => {
                p.rect(x + wx, 1, 3, 2, TIRE);
                p.rect(x + wx, 13, 3, 2, TIRE);
            });
            p.rect(x + 1, 2, 14, 12, '#6b4a2b');
            p.rect(x + 2, 3, 12, 10, '#c29b5f');
            for (let px = x + 5; px < x + 14; px += 4) {
                p.rect(px, 3, 1, 10, '#a77f45'); // planks
            }
            p.rect(x + 3, 10, 3, 2, '#7a5532'); // a splash of mud
            p.rect(x + 15, 7, 1, 2, '#555555'); // hitch

            // The piglet, nose to the front, with a curly tail
            p.ellipse(x + 7, 8, 4.4, 3.5, PIG_DARK);
            p.ellipse(x + 7, 8, 3.8, 2.9, PIG);
            p.rect(x + 2, 7, 1, 1, PIG_DARK);
            p.rect(x + 1, 8, 1, 1, PIG_DARK);
            p.ellipse(x + 11.5, 8, 2.8, 2.8, PIG_DARK);
            p.ellipse(x + 11.5, 8, 2.2, 2.2, PIG);
            p.rect(x + 10, 4, 2, 2, PIG_DARK); // ears
            p.rect(x + 10, 10, 2, 2, PIG_DARK);
            p.rect(x + 13, 7, 2, 2, SNOUT);
            p.rect(x + 14, 7, 1, 1, '#c2185b');
            p.rect(x + 14, 8, 1, 1, '#c2185b');
            p.rect(x + 11, 6, 1, 1, '#1b1b1b');
            p.rect(x + 11, 9, 1, 1, '#1b1b1b');
        }

        // The tractor: big back wheels, little front wheels, a seat and a long hood
        const x = (len - 1) * ART;
        const dark = shade(color, -70), light = shade(color, 50);
        p.rect(x, 7, 1, 2, '#555555');
        p.rect(x + 1, 0, 6, 4, TIRE);
        p.rect(x + 1, 12, 6, 4, TIRE);
        [2, 4, 6].forEach(tx => {
            p.rect(x + tx, 0, 1, 4, '#4a4a4a'); // treads
            p.rect(x + tx, 12, 1, 4, '#4a4a4a');
        });
        p.rect(x + 11, 2, 3, 2, TIRE);
        p.rect(x + 11, 12, 3, 2, TIRE);
        p.rect(x + 1, 4, 14, 8, dark);
        p.rect(x + 2, 5, 12, 6, color);
        p.rect(x + 8, 5, 6, 1, light);
        p.rect(x + 3, 6, 3, 4, '#2b2b2b'); // seat
        p.rect(x + 6, 7, 1, 2, '#1b1b1b'); // steering wheel
        p.rect(x + 10, 7, 2, 2, '#4a4a4a'); // exhaust pipe
        p.rect(x + 14, 5, 1, 2, HEADLIGHT);
        p.rect(x + 14, 9, 1, 2, HEADLIGHT);
    }

    // A tour bus in the piece's color, covered in stars and music notes
    function drawTourBus(p, len, color) {
        const W = len * ART;
        const dark = shade(color, -80), light = shade(color, 50);
        [5, W - 10].forEach(x => {
            p.rect(x, 1, 5, 2, TIRE);
            p.rect(x, 13, 5, 2, TIRE);
        });
        p.rect(1, 2, W - 2, 12, dark);
        p.rect(2, 3, W - 4, 10, color);
        p.rect(2, 3, W - 4, 1, light);
        p.rect(2, 12, W - 4, 1, '#ffffff'); // a shiny stripe down each side
        p.rect(2, 3, W - 4, 1, '#ffffff');

        // Decorations along the roof: a star, then a note, then a star...
        for (let x = 4, i = 0; x + 5 < W - 11; x += 7, i++) {
            if (i % 2 === 0) {
                p.rect(x + 2, 5, 1, 5, '#ffd23f');
                p.rect(x, 7, 5, 1, '#ffd23f');
                p.rect(x + 1, 6, 3, 3, '#ffd23f');
                p.rect(x + 2, 7, 1, 1, '#ffffff');
            } else {
                p.rect(x + 3, 5, 1, 4, '#ffffff'); // a music note
                p.rect(x + 3, 5, 2, 1, '#ffffff');
                p.rect(x + 1, 8, 3, 2, '#ffffff');
            }
        }

        p.rect(W - 11, 4, 3, 8, GLASS);
        p.rect(W - 10, 5, 1, 2, '#ffffff');
        [[1, 2], [W - 2, 2], [1, 13], [W - 2, 13]].forEach(([x, y]) => p.clear(x, y));
        p.rect(W - 3, 3, 2, 2, HEADLIGHT);
        p.rect(W - 3, 11, 2, 2, HEADLIGHT);
        p.rect(1, 3, 2, 2, '#ff4fd8'); // pink taillights
        p.rect(1, 11, 2, 2, '#ff4fd8');
    }

    // A round, soft body with a fluffy, scalloped edge, two little paws reaching forward and a
    // few strands of lighter fur
    function fuzzyBall(p, cx, cy, r, fur, dark, light) {
        const pawX = Math.round(cx + r * 0.35);
        p.ellipse(pawX + 0.5, cy - r + 0.2, 1.6, 1.4, dark);
        p.ellipse(pawX + 0.5, cy + r - 0.2, 1.6, 1.4, dark);
        p.ellipse(cx, cy, r + 0.6, r + 0.6, dark);
        // Clumps of fur around the edge, so the outline is soft and lumpy instead of perfectly round
        for (let a = 0; a < 10; a++) {
            const angle = (a + 0.5) / 10 * Math.PI * 2;
            p.ellipse(cx + Math.cos(angle) * (r - 0.4), cy + Math.sin(angle) * (r - 0.4), 1.5, 1.5, dark);
        }
        p.ellipse(cx, cy, r - 0.3, r - 0.3, fur);
        for (let a = 0; a < 10; a++) {
            const angle = (a + 0.5) / 10 * Math.PI * 2;
            p.ellipse(cx + Math.cos(angle) * (r - 0.9), cy + Math.sin(angle) * (r - 0.9), 1.1, 1.1, fur);
        }
        [[-0.55, -0.4], [-0.15, -0.6], [-0.6, 0.2], [-0.2, 0.5]].forEach(([fx, fy]) => {
            p.rect(Math.round(cx + fx * r), Math.round(cy + fy * r), 1, 2, light);
        });
    }

    // One big eye, looking straight ahead (the babies' are smaller and plainer)
    function fuzzEye(p, x, big) {
        const r = big ? 3.5 : 2.5;
        p.ellipse(x + 9.5, 8, r, r, '#1b1b1b');
        p.ellipse(x + 9.5, 8, r - 0.7, r - 0.7, '#ffffff');
        p.rect(x + 9, 7, 2, 2, '#1b1b1b');
        if (big) {
            p.rect(x + 9, 6, 2, 1, '#1b1b1b');
            p.rect(x + 9, 9, 2, 1, '#1b1b1b');
            p.rect(x + 8, 7, 1, 2, '#1b1b1b');
            p.rect(x + 9, 7, 1, 1, '#ffffff');
        }
    }

    // Fuzzballs: original round, shaggy monsters, each with one big eye and one buck tooth.
    // A big one with little horns leads, and baby fuzzballs follow along behind.
    function drawFuzzballs(p, len, color) {
        const dark = shade(color, -75), light = shade(color, 55);

        for (let i = 0; i < len - 1; i++) {
            const x = i * ART;
            fuzzyBall(p, x + 8, 8, 4.4, color, dark, light);
            fuzzEye(p, x, false);
        }

        const x = (len - 1) * ART;
        // Two little round horns
        p.rect(x + 9, 1, 2, 2, '#f5e6c8');
        p.rect(x + 9, 13, 2, 2, '#f5e6c8');
        fuzzyBall(p, x + 7.5, 8, 5.6, color, dark, light);
        fuzzEye(p, x, true);
        // A smile with one buck tooth
        p.rect(x + 13, 6, 1, 4, dark);
        p.rect(x + 12, 5, 1, 1, dark);
        p.rect(x + 12, 10, 1, 1, dark);
        p.rect(x + 13, 7, 1, 2, '#ffffff');
    }

    const DRAW = {
        cars: drawCar, trains: drawTrain, ducks: drawDucks, carts: drawCarts,
        dragons: drawDragon, kitties: drawKitty, piggies: drawPiggies, popstars: drawTourBus,
        fuzzballs: drawFuzzballs,
    };

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
        DRAW[ride](painter(ctx), piece.len, piece.color, piece.colorName);
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
                } else if (ride === 'dragons') {
                    noise({ dur: 0.25, vol: 0.08 }); // whoosh
                    tone({ freq: 140, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.08 }); // rawr
                } else if (ride === 'kitties') {
                    tone({ freq: 520, to: 880, dur: 0.12, type: 'triangle', vol: 0.12 }); // mee-ow
                    tone({ freq: 880, to: 440, dur: 0.22, type: 'triangle', vol: 0.12, delay: 0.12 });
                } else if (ride === 'piggies') {
                    tone({ freq: 260, to: 170, dur: 0.12, type: 'sawtooth', vol: 0.07 }); // oink oink
                    tone({ freq: 250, to: 160, dur: 0.14, type: 'sawtooth', vol: 0.07, delay: 0.16 });
                } else if (ride === 'fuzzballs') {
                    tone({ freq: 220, to: 660, dur: 0.12, type: 'triangle', vol: 0.12 }); // boing boing
                    tone({ freq: 260, to: 780, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.14 });
                } else if (ride === 'popstars') {
                    [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, dur: 0.08, vol: 0.06, delay: i * 0.06 }));
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
            // A coin pinging into the pile
            coin(delay = 0) {
                tone({ freq: 988, dur: 0.07, vol: 0.06, delay });
                tone({ freq: 1319, dur: 0.18, vol: 0.06, delay: delay + 0.07 });
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
                <span class="mw-coins"></span>
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
        coins: root.querySelector('.mw-coins'),
        sound: root.querySelector('.mw-sound'),
        stage: root.querySelector('.mw-stage'),
        board: root.querySelector('.mw-board'),
        message: root.querySelector('.mw-message'),
        overlay: root.querySelector('.mw-overlay'),
        panel: root.querySelector('.mw-panel'),
    };

    // Write text into an element, with any numbers in the blocky title font. In the reading
    // font a 2 looks like an 8 and a 5 like an S, which is no good for a level or coin count.
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

    // A gold coin: K is the outline, Y the gold, W a shine and D the stamped mark
    const COIN = [
        '..KKKK..',
        '.KYYYYK.',
        'KYWYDYYK',
        'KWYYDYYK',
        'KYYYDYYK',
        'KYYYDYDK',
        '.KYYYDK.',
        '..KKKK..',
    ];

    function pixelSvg(rows, colors, className) {
        let pixels = '';
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
            if (colors[ch]) {
                pixels += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"/>`;
            }
        }));
        return `<svg class="${className}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${pixels}</svg>`;
    }

    function heartSvg(full) {
        const colors = full ? { K: '#1b1b1b', R: '#e53935', W: '#ffffff' } : { K: '#1b1b1b', R: '#7a6656', W: '#7a6656' };
        return pixelSvg(HEART, colors, 'mw-heart');
    }

    function coinSvg() {
        return pixelSvg(COIN, { K: '#5c3d00', Y: '#ffc928', W: '#fff4b0', D: '#d19a00' }, 'mw-coin');
    }

    // "🪙 150", with the number in the blocky font
    function coinsHtml(count) {
        return `<span class="mw-coin-count">${coinSvg()}<span class="mw-num">${count}</span></span>`;
    }

    function updateBar() {
        write(el.level, 'Level ' + state.level);
        el.hearts.innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) => heartSvg(i < state.hearts)).join('');
        el.hearts.setAttribute('aria-label', state.hearts + (state.hearts === 1 ? ' heart' : ' hearts') + ' left');
        el.coins.innerHTML = coinsHtml(state.coins);
        el.coins.setAttribute('aria-label', state.coins + (state.coins === 1 ? ' coin' : ' coins'));
        el.sound.textContent = state.muted ? '🔇 Sound off' : '🔊 Sound on';
        el.sound.setAttribute('aria-pressed', String(!state.muted));
    }

    // Smaller squares than this are too fiddly to tap, so the board scrolls instead (see .mw-stage)
    const MIN_CELL = 22;

    // Size the board to fit the space between the bar and the message, whichever way the screen
    // is turned. That space is measured rather than worked out from the window, so it already
    // leaves out the iPad's status bar and home bar and a message that wraps onto a second line.
    // The stage's padding is the room for the board's frame.
    function layout() {
        if (!state.cols) {
            return;
        }
        const style = getComputedStyle(el.stage);
        const width = el.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const height = el.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const cell = Math.max(MIN_CELL, Math.floor(Math.min(width / state.cols, height / state.rows, 140)));
        el.board.style.setProperty('--cell', cell + 'px');
    }

    // Again whenever that space changes size: turning the iPad, the bar wrapping onto another
    // line, or the message getting longer or shorter. (The space doesn't depend on the board,
    // so resizing the board can't set this off again.)
    if (window.ResizeObserver) {
        new ResizeObserver(layout).observe(el.stage);
    } else {
        window.addEventListener('resize', layout);
    }

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

        // Coins: one for the level, one more for no bonks and a bonus every 5 levels
        const earned = [['Level done', COINS_PER_LEVEL]];
        if (state.bonks === 0) {
            earned.push(['Perfect! Not a single bonk!', COINS_FOR_PERFECT]);
        }
        if (finished % 5 === 0) {
            earned.push([`Level ${finished} bonus!`, COINS_EVERY_FIFTH]);
        }
        const total = earned.reduce((sum, [, coins]) => sum + coins, 0);
        state.coins += total;
        saveProgress();
        updateBar();
        earned.forEach((_, i) => sound.coin(0.7 + i * 0.25));

        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">Level ${finished} complete!</h2>
            <p class="mw-stars" aria-label="3 stars">★ ★ ★</p>
            <p class="mw-big">${escapeHtml(cheer())}</p>
            <ul class="mw-earned">
                ${earned.map(([why, coins]) => `<li><span>${numbers(why)}</span><span>+${coinsHtml(coins)}</span></li>`).join('')}
            </ul>
            <p class="mw-coin-total">You have ${coinsHtml(state.coins)} coins</p>
            ${nextGoalHtml()}
            <button type="button" class="mw-button mw-go" data-action="next">Next level</button>
        `);
    }

    // What he's saving up for: the cheapest ride in the shop he doesn't have yet
    function nextGoal() {
        return Object.keys(RIDES)
            .filter(key => isForSale(key) && !state.owned.includes(key))
            .sort((a, b) => RIDES[a].price - RIDES[b].price)[0];
    }

    function progressHtml(key) {
        const price = RIDES[key].price;
        const percent = Math.min(100, Math.floor(state.coins / price * 100));
        return `<span class="mw-progress" role="img" aria-label="${Math.min(state.coins, price)} of ${price} coins">` +
            `<span class="mw-progress-fill" style="width: ${percent}%"></span></span>`;
    }

    function nextGoalHtml() {
        const key = nextGoal();
        if (!key) {
            return '';
        }
        const ride = RIDES[key];
        const left = ride.price - state.coins;
        const text = left > 0
            ? `${left} more for ${ride.label}!`
            : `You can buy ${ride.label} in the shop!`;
        return `<div class="mw-goal"><p>${numbers(text)}</p>${progressHtml(key)}</div>`;
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
            <p class="mw-note">${numbers(`Coins: ${state.coins}. Each level earns ${COINS_PER_LEVEL}, plus ${COINS_FOR_PERFECT} with no bonks ` +
                `and ${COINS_EVERY_FIFTH} more every 5th level. They buy rides in the shop on the Change ride panel.`)}</p>
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

    // A ride in the shop: its price, and how close he is to it
    function shopCard(key) {
        const ride = RIDES[key];
        return `
            <button type="button" class="mw-ride mw-ride--shop${state.coins >= ride.price ? ' mw-ride--affordable' : ''}" data-shop="${key}">
                <span class="mw-ride-art" data-preview="${key}"></span>
                <span class="mw-ride-name">${ride.label}</span>
                <span class="mw-price">${coinsHtml(ride.price)}</span>
                ${progressHtml(key)}
            </button>`;
    }

    // Draw each ride's picture into the cards on the panel
    function fillPreviews() {
        el.panel.querySelectorAll('[data-preview]').forEach(slot => {
            // A plain car is the most car-like car; the others look best three squares long
            const piece = { dir: 'right', len: slot.dataset.preview === 'cars' ? 2 : 3, color: '#e53935', colorName: 'red' };
            slot.append(spriteFor(piece, slot.dataset.preview));
        });
    }

    function showRidePicker(firstTime) {
        state.pickerFirstTime = firstTime;
        const keys = Object.keys(RIDES);
        const mine = keys.filter(canRideNow);
        const forSale = keys.filter(key => !canRideNow(key));
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">${firstTime ? 'Make Way!' : 'Pick your ride'}</h2>
            ${firstTime ? '<p class="mw-big">Help everyone get out of the traffic jam!</p>' : ''}
            <label class="mw-name">
                <span>What's your name?</span>
                <input type="text" maxlength="16" autocomplete="off" value="${escapeHtml(state.name)}">
            </label>
            <p class="mw-pick">Pick your ride:</p>
            <div class="mw-rides">${mine.map(rideCard).join('')}</div>
            ${forSale.length ? `
                <h3 class="mw-shop-title">Shop</h3>
                <p class="mw-shop-coins">You have ${coinsHtml(state.coins)} coins. Every level earns more!</p>
                <div class="mw-rides">${forSale.map(shopCard).join('')}</div>` : ''}
            <button type="button" class="mw-button mw-go" data-action="start">Let's go!</button>
        `);
        fillPreviews();
    }

    function canRideNow(key) {
        return !isForSale(key) || state.owned.includes(key);
    }

    // A ride from the shop, up close: buy it, or see how many more coins it needs
    function showShopItem(key) {
        const ride = RIDES[key];
        const left = ride.price - state.coins;
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">${ride.place}</h2>
            <div class="mw-shop-art" data-preview="${key}"></div>
            <p class="mw-big">${escapeHtml(ride.about)}</p>
            <p class="mw-shop-price">Costs ${coinsHtml(ride.price)} coins. You have ${coinsHtml(state.coins)}.</p>
            ${left > 0 ? `
                ${progressHtml(key)}
                <p class="mw-big">${numbers(withName(`Just ${left} more coins to go{, name}! Keep clearing levels to earn them.`))}</p>
                <button type="button" class="mw-button mw-go" data-action="shop-back">OK</button>` : `
                <div class="mw-shop-buttons">
                    <button type="button" class="mw-button" data-action="shop-back">Not now</button>
                    <button type="button" class="mw-button mw-go" data-action="buy" data-key="${key}">Buy it!</button>
                </div>`}
        `);
        const slot = el.panel.querySelector('[data-preview]');
        slot.append(spriteFor({ dir: 'right', len: 4, color: '#1e88e5', colorName: 'blue' }, key));
    }

    function buy(key) {
        const ride = RIDES[key];
        if (state.owned.includes(key) || state.coins < ride.price) {
            return;
        }
        state.coins -= ride.price;
        state.owned.push(key);
        state.ride = key;
        saveProgress();
        updateBar();
        sound.win();
        confetti();
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">It's yours!</h2>
            <div class="mw-shop-art" data-preview="${key}"></div>
            <p class="mw-big">${escapeHtml(withName(`Welcome to ${ride.place}{, name}!`))}</p>
            <p class="mw-note">${numbers(`You have ${state.coins} coins left. You can switch rides any time with Change ride.`)}</p>
            <button type="button" class="mw-button mw-go" data-action="play">Let's play!</button>
        `);
        const slot = el.panel.querySelector('[data-preview]');
        slot.append(spriteFor({ dir: 'right', len: 4, color: '#e53935', colorName: 'red' }, key));
    }

    // Back to the game after picking or buying a ride
    function play() {
        hidePanel();
        redrawRides();
        if (state.level === 1 && !state.driven) {
            say(RIDES[state.ride].tutorial);
        } else {
            say(withName(RIDES[state.ride].resume + ' Keep going.'));
        }
        restartHintTimer();
    }

    el.panel.addEventListener('click', ev => {
        const shopItem = ev.target.closest('[data-shop]');
        if (shopItem) {
            sound.wake();
            sound.click();
            keepTypedName();
            showShopItem(shopItem.dataset.shop);
            return;
        }

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
            keepTypedName();
            state.started = true;
            saveProgress();
            play();
        } else if (action.dataset.action === 'shop-back') {
            showRidePicker(state.pickerFirstTime);
        } else if (action.dataset.action === 'buy') {
            buy(action.dataset.key);
        } else if (action.dataset.action === 'play') {
            state.started = true;
            saveProgress();
            play();
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

    // Hold on to the name typed on the ride picker, even when he pops over to the shop first
    function keepTypedName() {
        const input = el.panel.querySelector('.mw-name input');
        if (input) {
            state.name = input.value.trim().slice(0, 16);
        }
    }

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
        mathProblem, MATH_LEVELS, showMathPanel, showGrownUps, showRidePicker, showShopItem,
        // Testing only: set the coins, e.g. MakeWay.coins(500)
        coins(count) {
            state.coins = count;
            saveProgress();
            updateBar();
        },
    };
})();
