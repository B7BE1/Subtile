/**
 * Error Logger (Passive, no UI blocking)
 */
(function () {
  'use strict';
  // Silent logger only, never blocks the screen
  window.getErrorLog = function () { return []; };
  window.clearErrorLog = function () {};
})();
