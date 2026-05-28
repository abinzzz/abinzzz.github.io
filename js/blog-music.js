(function () {
    'use strict';

    var storageKeys = {
        paused: 'blogMusicPaused',
        time: 'blogMusicCurrentTime',
        volume: 'blogMusicVolume',
        muted: 'blogMusicMuted'
    };
    var pjaxSelector = '#pjax-container';
    var player = document.getElementById('blog-music-player');
    var audio = document.getElementById('blog-music-audio');
    var playlist = [];

    function getStoredValue(key) {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : null;
        } catch (error) {
            return null;
        }
    }

    function setStoredValue(key, value) {
        try {
            if (window.localStorage) window.localStorage.setItem(key, value);
        } catch (error) {
            return;
        }
    }

    function decodePlaylist() {
        if (!player) return [];
        try {
            return JSON.parse(decodeURIComponent(player.getAttribute('data-playlist') || '[]'));
        } catch (error) {
            return [];
        }
    }

    function saveState() {
        if (!audio) return;
        if (!Number.isNaN(audio.currentTime)) {
            setStoredValue(storageKeys.time, String(audio.currentTime));
        }
        setStoredValue(storageKeys.volume, String(audio.volume));
        setStoredValue(storageKeys.muted, audio.muted ? 'true' : 'false');
    }

    function setPausedPreference(paused) {
        setStoredValue(storageKeys.paused, paused ? 'true' : 'false');
    }

    function updatePlayerUi() {
        if (!player || !audio) return;
        var isPlaying = !audio.paused;
        var icon = isPlaying ? '❚❚' : '▶';
        var toggle = player.querySelector('.blog-music-toggle');
        var state = player.querySelector('.blog-music-state');
        var mute = player.querySelector('.blog-music-mute');
        var fill = player.querySelector('.blog-music-progress-fill');
        var progress = player.querySelector('.blog-music-progress');
        if (toggle) {
            toggle.textContent = icon;
            toggle.setAttribute('aria-label', isPlaying ? 'Pause music' : 'Play music');
        }
        if (state) state.textContent = icon;
        if (mute) mute.textContent = audio.muted || audio.volume === 0 ? '×' : '♪';
        var percent = audio.duration ? Math.min(100, (audio.currentTime / audio.duration) * 100) : 0;
        if (fill) fill.style.width = percent + '%';
        if (progress) progress.setAttribute('aria-valuenow', String(Math.round(percent)));
        player.classList.toggle('is-playing', isPlaying);
    }

    function showAutoplayHint() {
        if (!player) return;
        var hint = player.querySelector('.blog-music-hint');
        if (hint) hint.hidden = false;
        player.classList.add('needs-user-play');
    }

    function hideAutoplayHint() {
        if (!player) return;
        var hint = player.querySelector('.blog-music-hint');
        if (hint) hint.hidden = true;
        player.classList.remove('needs-user-play');
    }

    function tryPlay(markUserChoice) {
        if (!audio) return;
        var playPromise = audio.play();
        if (markUserChoice) setPausedPreference(false);
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(function () {
                hideAutoplayHint();
                updatePlayerUi();
            }).catch(function () {
                showAutoplayHint();
                updatePlayerUi();
            });
        }
    }

    function togglePlay() {
        if (!audio) return;
        if (audio.paused) {
            tryPlay(true);
        } else {
            audio.pause();
            setPausedPreference(true);
            saveState();
            updatePlayerUi();
        }
    }

    function seekFromEvent(event) {
        if (!audio || !audio.duration) return;
        var progress = event.currentTarget;
        var rect = progress.getBoundingClientRect();
        var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * audio.duration;
        saveState();
        updatePlayerUi();
    }

    function initMusicPlayer() {
        if (!player || !audio) return;
        playlist = decodePlaylist();
        if (!playlist.length) return;
        audio.src = playlist[0].src;
        var savedVolume = parseFloat(getStoredValue(storageKeys.volume));
        audio.volume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.7;
        audio.muted = getStoredValue(storageKeys.muted) === 'true';
        audio.addEventListener('loadedmetadata', function () {
            var savedTime = parseFloat(getStoredValue(storageKeys.time));
            if (Number.isFinite(savedTime) && savedTime > 0 && savedTime < audio.duration) {
                audio.currentTime = savedTime;
            }
            if (getStoredValue(storageKeys.paused) !== 'true') {
                tryPlay(false);
            }
            updatePlayerUi();
        });
        audio.addEventListener('play', updatePlayerUi);
        audio.addEventListener('pause', updatePlayerUi);
        audio.addEventListener('timeupdate', function () {
            saveState();
            updatePlayerUi();
        });
        audio.addEventListener('volumechange', saveState);
        audio.addEventListener('ended', function () {
            audio.currentTime = 0;
            tryPlay(false);
        });
        player.querySelectorAll('.blog-music-toggle, .blog-music-cover-button').forEach(function (button) {
            button.addEventListener('click', togglePlay);
        });
        var mute = player.querySelector('.blog-music-mute');
        if (mute) {
            mute.addEventListener('click', function () {
                audio.muted = !audio.muted;
                updatePlayerUi();
            });
        }
        var progress = player.querySelector('.blog-music-progress');
        if (progress) {
            progress.addEventListener('click', seekFromEvent);
            progress.addEventListener('keydown', function (event) {
                if (!audio.duration) return;
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5)));
                    saveState();
                    updatePlayerUi();
                }
            });
        }
        updatePlayerUi();
    }

    function initTocCollapse() {
        var tocContainer = document.getElementById('post-toc');
        if (!tocContainer) return;
        var tocItems = tocContainer.querySelectorAll('.post-toc-item.post-toc-level-1, .post-toc-item.post-toc-level-2, .post-toc-item.post-toc-level-3');
        tocItems.forEach(function (item) {
            if (item.dataset.tocBound === 'true') return;
            if (item.classList.contains('toc-has-children')) return;
            if (item.querySelector('ol.post-toc-child')) {
                item.classList.add('toc-has-children');
                item.dataset.tocBound = 'true';
                var link = item.querySelector('.post-toc-link');
                if (link) {
                    link.addEventListener('click', function (event) {
                        if (event.ctrlKey || event.metaKey || event.button === 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        item.classList.toggle('toc-expanded');
                    });
                    link.addEventListener('dblclick', function () {
                        var href = link.getAttribute('href');
                        if (href) window.location.hash = href;
                    });
                }
            }
        });
    }

    function reinitPageBehaviors() {
        initTocCollapse();
        if (window.LazyLoad) {
            window.blogLazyLoad = new LazyLoad(window.lazyLoadOptions || {});
        }
    }

    function shouldHandleLink(anchor, event) {
        if (!anchor || event.defaultPrevented || event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        if (anchor.target && anchor.target !== '_self') return false;
        if (anchor.hasAttribute('download')) return false;
        var url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        if (url.pathname.indexOf('/search/') === 0 || url.hash && url.pathname === window.location.pathname) return false;
        return true;
    }

    function updateHead(nextDocument) {
        document.title = nextDocument.title;
        var currentCanonical = document.querySelector('link[rel="canonical"]');
        var nextCanonical = nextDocument.querySelector('link[rel="canonical"]');
        if (currentCanonical && nextCanonical) currentCanonical.href = nextCanonical.href;
    }

    function runInlineScripts(container) {
        container.querySelectorAll('script').forEach(function (oldScript) {
            var script = document.createElement('script');
            Array.prototype.slice.call(oldScript.attributes).forEach(function (attr) {
                script.setAttribute(attr.name, attr.value);
            });
            script.textContent = oldScript.textContent;
            oldScript.parentNode.replaceChild(script, oldScript);
        });
    }

    function loadPage(url, pushState) {
        var container = document.querySelector(pjaxSelector);
        if (!container) {
            window.location.href = url;
            return;
        }
        document.documentElement.classList.add('is-pjax-loading');
        fetch(url, { credentials: 'same-origin' })
            .then(function (response) {
                if (!response.ok) throw new Error('Failed to load page');
                return response.text();
            })
            .then(function (html) {
                var nextDocument = new DOMParser().parseFromString(html, 'text/html');
                var nextContainer = nextDocument.querySelector(pjaxSelector);
                if (!nextContainer) {
                    window.location.href = url;
                    return;
                }
                updateHead(nextDocument);
                container.innerHTML = nextContainer.innerHTML;
                runInlineScripts(container);
                if (pushState) history.pushState({ url: url }, nextDocument.title, url);
                window.scrollTo(0, 0);
                reinitPageBehaviors();
            })
            .catch(function () {
                window.location.href = url;
            })
            .finally(function () {
                document.documentElement.classList.remove('is-pjax-loading');
            });
    }

    function initPjax() {
        document.addEventListener('click', function (event) {
            var anchor = event.target.closest('a');
            if (!shouldHandleLink(anchor, event)) return;
            event.preventDefault();
            loadPage(anchor.href, true);
        });
        window.addEventListener('popstate', function () {
            loadPage(window.location.href, false);
        });
    }

    window.initBlogPageBehaviors = reinitPageBehaviors;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initMusicPlayer();
            initPjax();
            reinitPageBehaviors();
        });
    } else {
        initMusicPlayer();
        initPjax();
        reinitPageBehaviors();
    }
})();
