/*jslint white: true */
/*global window */

/**
 * BigTable implements table functionality with virtual scrolling for huge data sets.
 */
window.BigTable = (function (window, BigList) {
  'use strict';

  /**
   * Helper function for checking if localStorage is available.
   */
  function localStorageAvailable() {
    try {
      var storage = window.localStorage,
        x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } 
    catch(e) {
      return false;
    }
  }

  /**
   * Creates a new instance of BigTable.
   * 
   * options.columns should be in following format: 
   * [{title: String, type: Type, key: String, format: val1 => val2, css: {class1: val1 => {true|false}}, [sorted: {true|false}]}]
   *
   * @class      BigTable
   * @param      {Objects}  options    Table options: {container, data, columns}.
   */
  function BigTable (options) {
    
    // Default settings
    var defaults = {
      container: undefined,
      data: undefined,
      columns: undefined,
      render: createRow
    };

    // Private fields
    var document = window.document,
        uid,
        bigList,
        container,
        header,
        isLocalStorageAvailable = localStorageAvailable(),
        sortOrder = {};

    /**
     * Helper function for checking if a text is a link.
     *
     * @param      {String}   text    Text to check.
     * @return     {boolean}  True if is a link, False otherwise.
     */
    function isLinkText(text) {
      return /^http(s)?:\/\//.test(text);
    }

    /**
     * Creates table cell Node.
     *
     * @param      {String}        text     Cell text.
     * @param      {String|Array}  classes  Cell css classes.
     */
    function createCell(text, classes) {
      if (!Array.isArray(classes)) {
        classes = classes.split(' ');
      }

      var cell = document.createElement('div');
      for (var i = 0, len = classes.length; i < len; i+=1) {
        cell.classList.add(classes[i]);
      }

      var node = document.createTextNode(text);
      if (isLinkText(text)) {
        var link = document.createElement('a');
        link.href = text;
        link.appendChild(node);
        node = link;
      }
      
      cell.appendChild(node);
      return cell;
    }

    /**
     * Retrieves custom css classes for column value.
     *
     * @param      {Number}  cidx    Column index.
     * @param      {String}  value   Cell value.
     * @return     {Array}   Custom css classes.
     */
    function getCellClasses(cidx, value) {
      var col = options.columns[cidx];
      var result = [];
      Object.keys(col.css).forEach(function (cssClass) {
        if (col.css[cssClass] === true || col.css[cssClass](value)) {
          result.push(cssClass);
        }
      });
      return result;
    }

    /**
     * Creates header Node.
     */
    function createHeader() {
      var header = document.createElement('div');
      header.classList.add('big-table__header');
      header.style.overflow = 'hidden';
      
      var classes, cell, cellData;
      for (var i = 0, len = options.columns.length; i < len; i+=1) {
        classes = getCellClasses(i);
        classes.push('big-table__col-header');

        // appending cell class
        if (options.columns[i].type === Number || options.columns[i].type === String) {
          classes.push('big-table__col-header-sortable');
        }

        cell = createCell(options.columns[i].title, classes);
        cell.setAttribute('data-idx', i); // set column index to read later

        header.appendChild(cell);
      }

      return header;
    }

    /**
     * Creates viewport for Node virtual scrolling.
     */
    function createViewport() {
      var viewport = document.createElement('div');
      viewport.classList.add('big-table__body');
      return viewport;
    }

    /**
     * Creates row Node.
     *
     * @param      {number}  ridx       Row index.
     */
    function createRow(ridx) {
      var row = document.createElement('div');
      row.classList.add('big-table__row');
      
      var val, classes;
      for (var i = 0, len = options.columns.length; i < len; i+=1) {
        val = options.columns[i].key ? options.data[ridx][options.columns[i].key] : null;

        classes = getCellClasses(i, val);
        classes.push('big-table__cell');

        // formatting value
        val = options.columns[i].format && options.columns[i].format(val) || val;

        // appending cell
        row.appendChild(createCell(val, classes));
      }

      return row;
    }

    /**
     * Validates options.
     */
    function validateOptions() {
      if (!options.container) {
        throw new Error('container option required.');
      }
      if (!options.data) {
        throw new Error('data option required.');
      }
      if (!options.columns) {
        throw new Error('columns option required.');
      }
    }

    /**
     * Re-draws a table.
     */
    function redraw() {
      if (bigList) {
        bigList.redraw();
      }
    }

    /**
     * Numberic comparator helper function.
     *
     * @param      {string}   key      Object key to compare.
     * @param      {Boolean}  reverse  Indicates if reverse order required.
     */
    function compareNumeric(key, reverse) {
      return function (a, b) {
        var res = a[key] - b[key];
        return !reverse ? res : -res;
      };
    }

    /**
     * String comparator helper function.
     *
     * @param      {string}   key      Object key to compare.
     * @param      {Boolean}  reverse  Indicates if reverse order required.
     */
    function compareString(key, reverse) {
      return function (a, b) {
        if (a[key] > b[key]) {
          return !reverse ? 1 : -1;
        }
        if (a[key] < b[key]) {
          return !reverse ? -1 : 1;
        }
        return 0;
      };
    }

    /**
     * Updates header colum sort* classes according to current sort column and sort order.
     *
     * @param      {Number}  idx     Current sort column index.
     * @param      {Boolean}  desc   Descending order.
     */
    function updateHeaderClasses(idx, desc) {
      var children = header.childNodes,
          len = children.length,
          child,
          i;

      for (i = 0; i < len; i+=1) {
        child = children[i];
        if (i === idx) {
          child.classList.remove('big-table__col-header_sorted-asc', 'big-table__col-header_sorted-desc');
          child.classList.add('big-table__col-header_sorted', desc ? 'big-table__col-header_sorted-desc' : 'big-table__col-header_sorted-asc');
        } else {
          child.classList.remove('big-table__col-header_sorted', 'big-table__col-header_sorted-asc', 'big-table__col-header_sorted-desc');
        }
      }
    }

    /**
     * Generates storage key.
     *
     * @param      {String}  appendix  Key appendix.
     */
    function getStorageKey(appendix) {
      var key = uid;
      if (appendix) {
        key = appendix + key;
      }
      return key;
    }

    /**
     * Caches sort order.
     *
     * @param      {Object}  order   Sort order: {column, desc}.
     */
    function setSortOrder(order) {
      if (order.desc === undefined) {
        order.desc = false;
      }

      if (isLocalStorageAvailable) {
        window.localStorage.setItem(getStorageKey('sortOrder'), JSON.stringify(order));
      } else {
        sortOrder = order;  
      }
    }

    /**
     * Retrieves sort order from cache.
     */
    function getSortOrder() {
      var order;
      if (isLocalStorageAvailable) {
        order = window.localStorage.getItem(getStorageKey('sortOrder'));
        order = order ? JSON.parse(order) : null;
      } else {
        order = sortOrder;
      }

      return order || {};
    }

    /**
     * Sorts data and redraws the table.
     *
     * @param      {Number}   i          Column index.
     * @param      {Boolean}  desc       Descending order.
     */
    function sort(i, desc) {
      // updating column heeader classes
      updateHeaderClasses(i, desc);

      var key = options.columns[i].key;
      if (options.columns[i].type === Number) {
        options.data.sort(compareNumeric(key, desc));
      } else if (options.columns[i].type === String) {
        options.data.sort(compareString(key, desc));
      } else {
        return;
      }

      // redrawing visible items
      redraw();
    }

    /**
     * Sorts or toggles sort direction for the column.
     *
     * @param      {Number}   i          Column index.
     * @param      {Boolean}  direction  Sort direction: true = asc, false = desc
     */
    function sortClickHandler(i, direction) {
      // get current sort order
      var order = getSortOrder();

      if (order.column === i) {
        order.desc = !order.desc;
      } else {
        order.column = i;
        order.desc = direction !== undefined ? !direction : false;
      }

      // cache sort order
      setSortOrder(order);

      // sort
      sort(order.column, order.desc);
    }

    /**
     * Header event listener.
     *
     * @param      {Event}  e       Event.
     */
    function headerEventListener(e) {
      // x-browser target
      e = e || window.event;
      var target = e.target || e.srcElement;

      if (!target.classList.contains('big-table__col-header')) {
        return;
      }

      var idx = +target.getAttribute('data-idx');
      if (options.columns[idx].type !== Number && options.columns[idx].type !== String) {
        return;
      }
      
      sortClickHandler(idx);
    }

    /**
     * Register header event handlers.
     */
    function registerHeaderHandlers() {
      // event delegation
      header.addEventListener('click', headerEventListener);
    }

    /**
     * Deregisters header event handlers.
     */
    function deregisterHeaderHandlers() {
      header.removeEventListener('click', headerEventListener);
    }

    /**
     * Initially sorts the data by the column's 'sorted' flag or by the last sort order.
     */
    function initSort() {
      var sorted;
      for (var i = 0, len = options.columns.length; i < len; i+=1) {
        sorted = options.columns[i].sorted;
        if (sorted !== undefined) {
          sortClickHandler(i, sorted);
          return;
        }
      }

      // if sort order is not defined in columns, sorting by last sort order
      var order = getSortOrder();
      if (order.column) {
        sort(order.column, order.desc);
      }
    }

    /**
     * Inits a BigTable.
     */
    function init() {
      options = Object.assign({}, defaults, options);

      // validate options
      validateOptions();

      // using container as a unique id
      uid = options.container;

      // configure container
      container = document.querySelector(options.container);
      if (container === null) {
        throw new Error('Could not find ' + options.container + ' element in the DOM.');
      }

      clearNode(container);
      container.classList.add('big-table');
      
      // configure header
      header = createHeader();
      registerHeaderHandlers();
      container.appendChild(header);

      // configure viewport
      var viewport = createViewport();      
      container.appendChild(viewport);

      // apply initial sorting
      initSort();

      // render list
      options.container += ' .big-table__body';
      options.totalCount = options.data.length;
      bigList = new BigList(options);
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
     * Destroys a table.
     */
    function destroy() {
      if (bigList) {
        deregisterHeaderHandlers();
        header = null;

        bigList.destroy();
        bigList = null;
        
        clearNode(container);
      }
    }

    // Init
    init();

    // Public interface
    return {
      destroy: destroy
    };
  }

  return BigTable;

}(window, window.BigList));
