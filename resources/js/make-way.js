/*
 * Make Way! A traffic-jam puzzle for kids (opened from the video game theme).
 *
 * The board is full of cars (or trains, ducks or mine carts), each pointing one way.
 * Tap one and it drives off the board, unless something is in its way, in which case it
 * goes BONK and rolls back. Nothing is ever lost: there are no strikes and no game over.
 * Clear every ride to finish the level. Levels are generated, and grow slowly.
 *
 * A puzzle like this can never get stuck: driving a ride off only frees up space, so
 * any ride with a clear road is always a good move. The generator only has to make sure
 * no rides block each other in a circle, and it checks every board before using it.
 */
(function () {
    'use strict';

    // ---------- Saved progress (kept on this device only) ----------

    const store = {
        get(key, fallback) {
            try {
                const value = localStorage.getItem('makeWay.' + key);
                return value === null ? fallback : JSON.parse(value);
            } catch (e) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem('makeWay.' + key, JSON.stringify(value));
            } catch (e) { }
        },
    };

    const state = {
        level: store.get('level', 1),
        ride: store.get('ride', 'cars'),
        name: store.get('name', ''),
        muted: store.get('muted', false),
        cols: 0,
        rows: 0,
        pieces: [],
        grid: [],
        driven: 0,
        hintTimer: null,
    };

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
            tutorial: 'Tap a car to drive it off the road. If another car is in the way, it goes BONK!',
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
            tutorial: 'Tap a train to send it down the tracks. If something is in the way, it goes BONK!',
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
            tutorial: 'Tap a mama duck to lead her ducklings away. If someone is in the way, they go BONK!',
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
            tutorial: 'Tap a mine cart to roll it out of the mine. If something is in the way, it goes BONK!',
            bumps: ['Clunk! Something is in the way.', 'Bonk! That tunnel is blocked.', 'Oops! Try a different cart.'],
        },
    };

    // ---------- Levels ----------

    // How big each level is. Boards grow slowly, and lie the long way on a sideways screen.
    function levelConfig(level, landscape) {
        let cols, rows, count;
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
            [cols, rows, count] = [8, 8, 15 + Math.min(5, Math.floor((level - 21) / 3))];
        }
        if (landscape && rows > cols) {
            [cols, rows] = [rows, cols];
        }
        return { cols, rows, count };
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
        level: root.querySelector('.mw-level'),
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

    function updateBar() {
        write(el.level, 'Level ' + state.level);
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
        const { cols, rows, count } = levelConfig(state.level, landscape);
        state.cols = cols;
        state.rows = rows;
        state.driven = 0;
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
        if (piece.moving) {
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
        }, hit);
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
        state.hintTimer = setTimeout(showHint, 8000);
    }

    // ---------- Finishing a level ----------

    function levelComplete() {
        clearTimeout(state.hintTimer);
        const finished = state.level;
        state.level++;
        store.set('level', state.level);
        sound.win();
        confetti();

        const trophy = finished % 5 === 0;
        const trophies = Math.floor(finished / 5);
        showPanel(`
            <h2 id="mw-panel-title" class="mw-panel-title">Level ${finished} complete!</h2>
            <p class="mw-stars" aria-label="3 stars">★ ★ ★</p>
            <p class="mw-big">${escapeHtml(cheer())}</p>
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

    // ---------- Panels: picking a ride, and level complete ----------

    function showPanel(html) {
        el.panel.innerHTML = html;
        el.overlay.hidden = false;
        // Focus the big button rather than the name box, which would pop up the iPad keyboard
        el.panel.querySelector('.mw-go').focus();
    }

    function hidePanel() {
        el.overlay.hidden = true;
    }

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

        const action = ev.target.closest('[data-action]');
        if (!action) {
            return;
        }
        sound.wake();
        sound.click();
        if (action.dataset.action === 'start') {
            const input = el.panel.querySelector('input');
            state.name = input.value.trim().slice(0, 16);
            store.set('name', state.name);
            store.set('ride', state.ride);
            store.set('started', true);
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
        }
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
            store.set('muted', state.muted);
            updateBar();
        } else if (action.dataset.action === 'hint') {
            sound.click();
            showHint();
            restartHintTimer();
        } else if (action.dataset.action === 'ride') {
            sound.click();
            clearTimeout(state.hintTimer);
            showRidePicker(false);
        }
    });

    // ---------- Off we go ----------

    updateBar();
    startLevel();
    if (!store.get('started', false)) {
        // The very first time: say hello and pick a ride
        clearTimeout(state.hintTimer);
        showRidePicker(true);
    }

    // For poking at in the browser console (and the tests): build a board without playing it
    window.MakeWay = { levelConfig, generateLevel, solvable, blockerOf, emptyGrid, occupy, spriteFor, RIDES };
})();
