/*
 * Theme switcher.
 *
 * The themes themselves are pure CSS (resources/css/themes/). All this script
 * does is set <html data-theme="..."> and remember the choice.
 *
 * It's loaded in <head> without defer/async on purpose: that way it runs
 * before the page is drawn, so a saved theme is already in place on the first
 * paint instead of flashing the default theme first.
 */
(function () {
    var root = document.documentElement;
    var STORAGE_KEY = 'theme';

    // Use the saved theme if there is one; otherwise keep the default set on <html>.
    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            root.dataset.theme = saved;
        }
    } catch (e) {
        // Storage can be blocked by privacy settings. The default theme still works.
    }

    // Highlight the current theme in the "This site is ugly" menu.
    function markCurrentTheme() {
        document.querySelectorAll('[data-set-theme]').forEach(function (button) {
            var isCurrent = button.dataset.setTheme === root.dataset.theme;
            if (isCurrent) {
                button.setAttribute('aria-current', 'true');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    }

    function applyTheme(name) {
        root.dataset.theme = name;
        markCurrentTheme();
    }

    function setTheme(name) {
        try {
            localStorage.setItem(STORAGE_KEY, name);
        } catch (e) { }

        // Cross-fade from the old look to the new one, in browsers that support it.
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (document.startViewTransition && !reduceMotion) {
            document.startViewTransition(function () {
                applyTheme(name);
            });
        } else {
            applyTheme(name);
        }
    }

    // The menu is part of navbar.html, which loads after this runs, so listen on the whole document.
    document.addEventListener('click', function (ev) {
        var button = ev.target.closest('[data-set-theme]');
        if (button) {
            setTheme(button.dataset.setTheme);
        }
    });
    document.addEventListener('navbar-loaded', markCurrentTheme);

    // Follow a theme change made in another tab of the site.
    window.addEventListener('storage', function (ev) {
        if (ev.key === STORAGE_KEY && ev.newValue) {
            applyTheme(ev.newValue);
        }
    });
})();
