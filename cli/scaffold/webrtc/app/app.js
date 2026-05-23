// app.js - {{NAME}} WebRTC demo entry point.

import './components/video-room.js';

$.ready(() => {
    $('#nav-version').text('v' + $.version);
    console.log('⚡ {{NAME}} - zQuery v' + $.version + ' WebRTC demo');
});
