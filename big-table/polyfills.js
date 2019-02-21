/*jslint white: true */

/**
 * ES6 Object.assign polyfill
 */
if (typeof Object.assign !== 'function') {
  Object.assign = function(target) {
    'use strict';

    if (target === null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    target = Object(target);
    for (var i = 1; i < arguments.length; i+=1) {
      var source = arguments[i];
      if (source !== null) {
        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
    }
    return target;
  };
}
