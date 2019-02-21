/*jslint white: true */
/*global window */

/**
 * BigList implements virtual scrolling functionality for huge data sets.
 */
window.BigList = (function (window) {
  'use strict';

  /**
   * BigList constructor function.
   *
   * @class      BigList
   * @param      {Objects}  options    List options.
   */
  function BigList(options) {

    // Default settings
    var defaults = {
      container: null,
      height: 500,
      itemHeight: 30,
      totalCount: 1000
    };

    // Private fields
    var document = window.document,
        container,
        itemsPerScreen,
        lastRepaintOffset,
        lastScrolledTime,
        garbage = {},
        cache = {},
        gcInterval;

    /**
     * Renders item by calling third-party render function.
     *
     * @param      {number}  idx     Item index.
     * @return     {Node}  Item Node.
     */
    function renderItem(idx) {
      var item = options.render(idx);

      // setting required styles
      item.style.height = options.itemHeight + 'px';
      item.style.position = 'absolute';
      item.style.top = (idx * options.itemHeight) + 'px';
      item.style.left = 0;
      item.style.right = 0;

      return item;
    }

    /**
     * Renders items from index idx to toIdx.
     *
     * @param      {number}  idx     First element index.
     * @param      {number}  toIdx   Last element index (not included).
     */
    function renderItemsFrom(idx, toIdx) {
      if (toIdx > options.totalCount) {
        toIdx = options.totalCount;
      }

      // marking invisible items for deletion
      var item;
      Object.keys(cache).forEach(function (i) {
        if (i >= idx && i < toIdx) {
          return;
        }

        var item = cache[i];
        item.style.display = 'none';
        garbage[i] = item;

        delete cache[i];
      });

      // rendering visible items
      var fragment = document.createDocumentFragment();
      for (var i = idx; i < toIdx; i+=1) {
        if (cache[i] === undefined && garbage[i] === undefined) {
          // not yet rendered
          
          // render item
          item = renderItem(i);

          // cache item
          cache[i] = item;

          // add to the fragment
          fragment.appendChild(item);
        } else if (garbage[i] !== undefined) {
          // not yet garbage collected
          item = garbage[i];
          item.style.display = 'block';
          cache[i] = item;

          delete garbage[i];
        }
      }

      container.appendChild(fragment);
    }

    /**
     * Collects garbage by removing hidden elements from DOM.
     *
     * @param      {boolean}  force   Indicates whether to force garbage collection.
     */
    function gc(force) {
      if (!force && new Date() - lastScrolledTime < 100) {
        // do not do garbage collection while scrolling
        return;
      }

      Object.keys(garbage).forEach(function (i) {
        container.removeChild(garbage[i]);
      });

      if (Object.keys(garbage).length > 0) {
        garbage = {};
      }
    }

    /**
     * Scroll event handler.
     *
     * @param      {Event}  event   Event object.
     */
    function onScroll(event) {
      var scrollTop = event.target.scrollTop;
      if (!lastRepaintOffset || Math.abs(scrollTop - lastRepaintOffset) > options.height) {
        // we scrolled more than 1 screen
        var firstIdx = parseInt(scrollTop / options.itemHeight) - itemsPerScreen;
        firstIdx = firstIdx < 0 ? 0 : firstIdx;

        // rendering items one screen before and one screen after the current position
        renderItemsFrom(firstIdx, firstIdx + 3 * itemsPerScreen);
        lastRepaintOffset = scrollTop;
      }

      lastScrolledTime = new Date();
      event.preventDefault();
    }

    /**
     * Clears node.
     *
     * @param      {Node}  Node.
     */
    function clearNode(node) {
      var child = node.lastChild;
      while (child) {
        node.removeChild(child);
        child = node.lastChild;
      }
    }

    /**
     * Specifies defaults for the container element.
     *
     * @param      {Node}  container  The container node.
     */
    function initContainer(container) {
      // empty node
      clearNode(container);

      // setting styles
      container.style.display = 'none';
      container.style.height = options.height + 'px';
      container.style.overflow = 'auto';
      container.style.position = 'relative';
      container.style.padding = '0';
      container.style.clear = 'both';
      container.style.display = 'block';

      // add scroll event listener
      container.addEventListener('scroll', onScroll);
    }

    /**
     * Creates helper scroller Node.
     *
     * @return     {Node}  Scroller Node.
     */
    function createScroller() {
      var scroller = document.createElement('div');
      scroller.style.opacity = 0;
      scroller.style.position = 'absolute';
      scroller.style.top = 0;
      scroller.style.left = 0;
      scroller.style.width = '1px';
      scroller.style.height = options.itemHeight * options.totalCount + 'px';

      return scroller;
    }

    /**
     * Inits a list for a container.
     */
    function init() {
      container = document.querySelector(options.container);
      if (container === null) {
        throw new Error('Could not find ' + options.container + ' element in the DOM.');
      }

      options = Object.assign({}, defaults, options);

      // init container
      initContainer(container);

      // init hidden scroller
      var scroller = createScroller();
      container.appendChild(scroller);

      // calculate number of items per screen
      itemsPerScreen = Math.ceil(options.height / options.itemHeight);

      // render first screen with some amount of cache
      renderItemsFrom(0, itemsPerScreen * 2);

      // delete hidden items periodically
      gcInterval = setInterval(gc, 300);
    }

    /**
     * Re-draws visible items.
     */
    function redraw() {
      // remove items
      Object.assign(garbage, cache);
      gc(true);

      // getting first and last index
      var indexes = Object.keys(cache).map(function (k) { return parseInt(k); });
      indexes = indexes.sort(function (a, b) {
        return a - b;
      });

      // redraw the list
      cache = {};
      renderItemsFrom(indexes[0], indexes[indexes.length - 1] + 1);
    }

    /**
     * Destroyes the list and all it's data.
     */
    function destroy() {
      container.removeEventListener('scroll', onScroll);
      clearInterval(gcInterval);

      cache = {};
      garbage = {};
      clearNode(container);
    }

    // Init
    init();

    // Public interface
    return {
      destroy: destroy,
      redraw: redraw
    };
  }

  return BigList;
}(window));
