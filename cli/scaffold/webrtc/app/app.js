// app.js - {{NAME}} WebRTC demo entry point.

import './components/video-room.js';

$.ready(() => {
    $('#nav-version').text('v' + $.version);
    // Instantiate every registered <component-tag> already in the DOM.
    // (No $.router() is wiring it up for us in this single-page scaffold.)
    $.mountAll();
    console.log('⚡ {{NAME}} - zQuery v' + $.version + ' WebRTC demo');
});
