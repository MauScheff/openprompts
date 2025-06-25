
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35737/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function set_data_contenteditable_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __classPrivateFieldGet(receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    }

    function __classPrivateFieldSet(receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // Copyright 2019-2024 Tauri Programme within The Commons Conservancy
    // SPDX-License-Identifier: Apache-2.0
    // SPDX-License-Identifier: MIT
    var _Resource_rid;
    /**
     * Sends a message to the backend.
     * @example
     * ```typescript
     * import { invoke } from '@tauri-apps/api/core';
     * await invoke('login', { user: 'tauri', password: 'poiwe3h4r5ip3yrhtew9ty' });
     * ```
     *
     * @param cmd The command name.
     * @param args The optional arguments to pass to the command.
     * @param options The request options.
     * @return A promise resolving or rejecting to the backend response.
     *
     * @since 1.0.0
     */
    async function invoke(cmd, args = {}, options) {
        return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
    }
    /**
     * A rust-backed resource stored through `tauri::Manager::resources_table` API.
     *
     * The resource lives in the main process and does not exist
     * in the Javascript world, and thus will not be cleaned up automatiacally
     * except on application exit. If you want to clean it up early, call {@linkcode Resource.close}
     *
     * @example
     * ```typescript
     * import { Resource, invoke } from '@tauri-apps/api/core';
     * export class DatabaseHandle extends Resource {
     *   static async open(path: string): Promise<DatabaseHandle> {
     *     const rid: number = await invoke('open_db', { path });
     *     return new DatabaseHandle(rid);
     *   }
     *
     *   async execute(sql: string): Promise<void> {
     *     await invoke('execute_sql', { rid: this.rid, sql });
     *   }
     * }
     * ```
     */
    class Resource {
        get rid() {
            return __classPrivateFieldGet(this, _Resource_rid, "f");
        }
        constructor(rid) {
            _Resource_rid.set(this, void 0);
            __classPrivateFieldSet(this, _Resource_rid, rid, "f");
        }
        /**
         * Destroys and cleans up this resource from memory.
         * **You should not call any method on this object anymore and should drop any reference to it.**
         */
        async close() {
            return invoke('plugin:resources|close', {
                rid: this.rid
            });
        }
    }
    _Resource_rid = new WeakMap();

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var regl = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
        module.exports = factory() ;
    }(commonjsGlobal, (function () {
    var isTypedArray = function (x) {
      return (
        x instanceof Uint8Array ||
        x instanceof Uint16Array ||
        x instanceof Uint32Array ||
        x instanceof Int8Array ||
        x instanceof Int16Array ||
        x instanceof Int32Array ||
        x instanceof Float32Array ||
        x instanceof Float64Array ||
        x instanceof Uint8ClampedArray
      )
    };

    var extend = function (base, opts) {
      var keys = Object.keys(opts);
      for (var i = 0; i < keys.length; ++i) {
        base[keys[i]] = opts[keys[i]];
      }
      return base
    };

    // Error checking and parameter validation.
    //
    // Statements for the form `check.someProcedure(...)` get removed by
    // a browserify transform for optimized/minified bundles.
    //
    /* globals atob */
    var endl = '\n';

    // only used for extracting shader names.  if atob not present, then errors
    // will be slightly crappier
    function decodeB64 (str) {
      if (typeof atob !== 'undefined') {
        return atob(str)
      }
      return 'base64:' + str
    }

    function raise (message) {
      var error = new Error('(regl) ' + message);
      console.error(error);
      throw error
    }

    function check (pred, message) {
      if (!pred) {
        raise(message);
      }
    }

    function encolon (message) {
      if (message) {
        return ': ' + message
      }
      return ''
    }

    function checkParameter (param, possibilities, message) {
      if (!(param in possibilities)) {
        raise('unknown parameter (' + param + ')' + encolon(message) +
              '. possible values: ' + Object.keys(possibilities).join());
      }
    }

    function checkIsTypedArray (data, message) {
      if (!isTypedArray(data)) {
        raise(
          'invalid parameter type' + encolon(message) +
          '. must be a typed array');
      }
    }

    function standardTypeEh (value, type) {
      switch (type) {
        case 'number': return typeof value === 'number'
        case 'object': return typeof value === 'object'
        case 'string': return typeof value === 'string'
        case 'boolean': return typeof value === 'boolean'
        case 'function': return typeof value === 'function'
        case 'undefined': return typeof value === 'undefined'
        case 'symbol': return typeof value === 'symbol'
      }
    }

    function checkTypeOf (value, type, message) {
      if (!standardTypeEh(value, type)) {
        raise(
          'invalid parameter type' + encolon(message) +
          '. expected ' + type + ', got ' + (typeof value));
      }
    }

    function checkNonNegativeInt (value, message) {
      if (!((value >= 0) &&
            ((value | 0) === value))) {
        raise('invalid parameter type, (' + value + ')' + encolon(message) +
              '. must be a nonnegative integer');
      }
    }

    function checkOneOf (value, list, message) {
      if (list.indexOf(value) < 0) {
        raise('invalid value' + encolon(message) + '. must be one of: ' + list);
      }
    }

    var constructorKeys = [
      'gl',
      'canvas',
      'container',
      'attributes',
      'pixelRatio',
      'extensions',
      'optionalExtensions',
      'profile',
      'onDone'
    ];

    function checkConstructor (obj) {
      Object.keys(obj).forEach(function (key) {
        if (constructorKeys.indexOf(key) < 0) {
          raise('invalid regl constructor argument "' + key + '". must be one of ' + constructorKeys);
        }
      });
    }

    function leftPad (str, n) {
      str = str + '';
      while (str.length < n) {
        str = ' ' + str;
      }
      return str
    }

    function ShaderFile () {
      this.name = 'unknown';
      this.lines = [];
      this.index = {};
      this.hasErrors = false;
    }

    function ShaderLine (number, line) {
      this.number = number;
      this.line = line;
      this.errors = [];
    }

    function ShaderError (fileNumber, lineNumber, message) {
      this.file = fileNumber;
      this.line = lineNumber;
      this.message = message;
    }

    function guessCommand () {
      var error = new Error();
      var stack = (error.stack || error).toString();
      var pat = /compileProcedure.*\n\s*at.*\((.*)\)/.exec(stack);
      if (pat) {
        return pat[1]
      }
      var pat2 = /compileProcedure.*\n\s*at\s+(.*)(\n|$)/.exec(stack);
      if (pat2) {
        return pat2[1]
      }
      return 'unknown'
    }

    function guessCallSite () {
      var error = new Error();
      var stack = (error.stack || error).toString();
      var pat = /at REGLCommand.*\n\s+at.*\((.*)\)/.exec(stack);
      if (pat) {
        return pat[1]
      }
      var pat2 = /at REGLCommand.*\n\s+at\s+(.*)\n/.exec(stack);
      if (pat2) {
        return pat2[1]
      }
      return 'unknown'
    }

    function parseSource (source, command) {
      var lines = source.split('\n');
      var lineNumber = 1;
      var fileNumber = 0;
      var files = {
        unknown: new ShaderFile(),
        0: new ShaderFile()
      };
      files.unknown.name = files[0].name = command || guessCommand();
      files.unknown.lines.push(new ShaderLine(0, ''));
      for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];
        var parts = /^\s*#\s*(\w+)\s+(.+)\s*$/.exec(line);
        if (parts) {
          switch (parts[1]) {
            case 'line':
              var lineNumberInfo = /(\d+)(\s+\d+)?/.exec(parts[2]);
              if (lineNumberInfo) {
                lineNumber = lineNumberInfo[1] | 0;
                if (lineNumberInfo[2]) {
                  fileNumber = lineNumberInfo[2] | 0;
                  if (!(fileNumber in files)) {
                    files[fileNumber] = new ShaderFile();
                  }
                }
              }
              break
            case 'define':
              var nameInfo = /SHADER_NAME(_B64)?\s+(.*)$/.exec(parts[2]);
              if (nameInfo) {
                files[fileNumber].name = (nameInfo[1]
                  ? decodeB64(nameInfo[2])
                  : nameInfo[2]);
              }
              break
          }
        }
        files[fileNumber].lines.push(new ShaderLine(lineNumber++, line));
      }
      Object.keys(files).forEach(function (fileNumber) {
        var file = files[fileNumber];
        file.lines.forEach(function (line) {
          file.index[line.number] = line;
        });
      });
      return files
    }

    function parseErrorLog (errLog) {
      var result = [];
      errLog.split('\n').forEach(function (errMsg) {
        if (errMsg.length < 5) {
          return
        }
        var parts = /^ERROR:\s+(\d+):(\d+):\s*(.*)$/.exec(errMsg);
        if (parts) {
          result.push(new ShaderError(
            parts[1] | 0,
            parts[2] | 0,
            parts[3].trim()));
        } else if (errMsg.length > 0) {
          result.push(new ShaderError('unknown', 0, errMsg));
        }
      });
      return result
    }

    function annotateFiles (files, errors) {
      errors.forEach(function (error) {
        var file = files[error.file];
        if (file) {
          var line = file.index[error.line];
          if (line) {
            line.errors.push(error);
            file.hasErrors = true;
            return
          }
        }
        files.unknown.hasErrors = true;
        files.unknown.lines[0].errors.push(error);
      });
    }

    function checkShaderError (gl, shader, source, type, command) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var errLog = gl.getShaderInfoLog(shader);
        var typeName = type === gl.FRAGMENT_SHADER ? 'fragment' : 'vertex';
        checkCommandType(source, 'string', typeName + ' shader source must be a string', command);
        var files = parseSource(source, command);
        var errors = parseErrorLog(errLog);
        annotateFiles(files, errors);

        Object.keys(files).forEach(function (fileNumber) {
          var file = files[fileNumber];
          if (!file.hasErrors) {
            return
          }

          var strings = [''];
          var styles = [''];

          function push (str, style) {
            strings.push(str);
            styles.push(style || '');
          }

          push('file number ' + fileNumber + ': ' + file.name + '\n', 'color:red;text-decoration:underline;font-weight:bold');

          file.lines.forEach(function (line) {
            if (line.errors.length > 0) {
              push(leftPad(line.number, 4) + '|  ', 'background-color:yellow; font-weight:bold');
              push(line.line + endl, 'color:red; background-color:yellow; font-weight:bold');

              // try to guess token
              var offset = 0;
              line.errors.forEach(function (error) {
                var message = error.message;
                var token = /^\s*'(.*)'\s*:\s*(.*)$/.exec(message);
                if (token) {
                  var tokenPat = token[1];
                  message = token[2];
                  switch (tokenPat) {
                    case 'assign':
                      tokenPat = '=';
                      break
                  }
                  offset = Math.max(line.line.indexOf(tokenPat, offset), 0);
                } else {
                  offset = 0;
                }

                push(leftPad('| ', 6));
                push(leftPad('^^^', offset + 3) + endl, 'font-weight:bold');
                push(leftPad('| ', 6));
                push(message + endl, 'font-weight:bold');
              });
              push(leftPad('| ', 6) + endl);
            } else {
              push(leftPad(line.number, 4) + '|  ');
              push(line.line + endl, 'color:red');
            }
          });
          if (typeof document !== 'undefined' && !window.chrome) {
            styles[0] = strings.join('%c');
            console.log.apply(console, styles);
          } else {
            console.log(strings.join(''));
          }
        });

        check.raise('Error compiling ' + typeName + ' shader, ' + files[0].name);
      }
    }

    function checkLinkError (gl, program, fragShader, vertShader, command) {
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var errLog = gl.getProgramInfoLog(program);
        var fragParse = parseSource(fragShader, command);
        var vertParse = parseSource(vertShader, command);

        var header = 'Error linking program with vertex shader, "' +
          vertParse[0].name + '", and fragment shader "' + fragParse[0].name + '"';

        if (typeof document !== 'undefined') {
          console.log('%c' + header + endl + '%c' + errLog,
            'color:red;text-decoration:underline;font-weight:bold',
            'color:red');
        } else {
          console.log(header + endl + errLog);
        }
        check.raise(header);
      }
    }

    function saveCommandRef (object) {
      object._commandRef = guessCommand();
    }

    function saveDrawCommandInfo (opts, uniforms, attributes, stringStore) {
      saveCommandRef(opts);

      function id (str) {
        if (str) {
          return stringStore.id(str)
        }
        return 0
      }
      opts._fragId = id(opts.static.frag);
      opts._vertId = id(opts.static.vert);

      function addProps (dict, set) {
        Object.keys(set).forEach(function (u) {
          dict[stringStore.id(u)] = true;
        });
      }

      var uniformSet = opts._uniformSet = {};
      addProps(uniformSet, uniforms.static);
      addProps(uniformSet, uniforms.dynamic);

      var attributeSet = opts._attributeSet = {};
      addProps(attributeSet, attributes.static);
      addProps(attributeSet, attributes.dynamic);

      opts._hasCount = (
        'count' in opts.static ||
        'count' in opts.dynamic ||
        'elements' in opts.static ||
        'elements' in opts.dynamic);
    }

    function commandRaise (message, command) {
      var callSite = guessCallSite();
      raise(message +
        ' in command ' + (command || guessCommand()) +
        (callSite === 'unknown' ? '' : ' called from ' + callSite));
    }

    function checkCommand (pred, message, command) {
      if (!pred) {
        commandRaise(message, command || guessCommand());
      }
    }

    function checkParameterCommand (param, possibilities, message, command) {
      if (!(param in possibilities)) {
        commandRaise(
          'unknown parameter (' + param + ')' + encolon(message) +
          '. possible values: ' + Object.keys(possibilities).join(),
          command || guessCommand());
      }
    }

    function checkCommandType (value, type, message, command) {
      if (!standardTypeEh(value, type)) {
        commandRaise(
          'invalid parameter type' + encolon(message) +
          '. expected ' + type + ', got ' + (typeof value),
          command || guessCommand());
      }
    }

    function checkOptional (block) {
      block();
    }

    function checkFramebufferFormat (attachment, texFormats, rbFormats) {
      if (attachment.texture) {
        checkOneOf(
          attachment.texture._texture.internalformat,
          texFormats,
          'unsupported texture format for attachment');
      } else {
        checkOneOf(
          attachment.renderbuffer._renderbuffer.format,
          rbFormats,
          'unsupported renderbuffer format for attachment');
      }
    }

    var GL_CLAMP_TO_EDGE = 0x812F;

    var GL_NEAREST = 0x2600;
    var GL_NEAREST_MIPMAP_NEAREST = 0x2700;
    var GL_LINEAR_MIPMAP_NEAREST = 0x2701;
    var GL_NEAREST_MIPMAP_LINEAR = 0x2702;
    var GL_LINEAR_MIPMAP_LINEAR = 0x2703;

    var GL_BYTE = 5120;
    var GL_UNSIGNED_BYTE = 5121;
    var GL_SHORT = 5122;
    var GL_UNSIGNED_SHORT = 5123;
    var GL_INT = 5124;
    var GL_UNSIGNED_INT = 5125;
    var GL_FLOAT = 5126;

    var GL_UNSIGNED_SHORT_4_4_4_4 = 0x8033;
    var GL_UNSIGNED_SHORT_5_5_5_1 = 0x8034;
    var GL_UNSIGNED_SHORT_5_6_5 = 0x8363;
    var GL_UNSIGNED_INT_24_8_WEBGL = 0x84FA;

    var GL_HALF_FLOAT_OES = 0x8D61;

    var TYPE_SIZE = {};

    TYPE_SIZE[GL_BYTE] =
    TYPE_SIZE[GL_UNSIGNED_BYTE] = 1;

    TYPE_SIZE[GL_SHORT] =
    TYPE_SIZE[GL_UNSIGNED_SHORT] =
    TYPE_SIZE[GL_HALF_FLOAT_OES] =
    TYPE_SIZE[GL_UNSIGNED_SHORT_5_6_5] =
    TYPE_SIZE[GL_UNSIGNED_SHORT_4_4_4_4] =
    TYPE_SIZE[GL_UNSIGNED_SHORT_5_5_5_1] = 2;

    TYPE_SIZE[GL_INT] =
    TYPE_SIZE[GL_UNSIGNED_INT] =
    TYPE_SIZE[GL_FLOAT] =
    TYPE_SIZE[GL_UNSIGNED_INT_24_8_WEBGL] = 4;

    function pixelSize (type, channels) {
      if (type === GL_UNSIGNED_SHORT_5_5_5_1 ||
          type === GL_UNSIGNED_SHORT_4_4_4_4 ||
          type === GL_UNSIGNED_SHORT_5_6_5) {
        return 2
      } else if (type === GL_UNSIGNED_INT_24_8_WEBGL) {
        return 4
      } else {
        return TYPE_SIZE[type] * channels
      }
    }

    function isPow2 (v) {
      return !(v & (v - 1)) && (!!v)
    }

    function checkTexture2D (info, mipData, limits) {
      var i;
      var w = mipData.width;
      var h = mipData.height;
      var c = mipData.channels;

      // Check texture shape
      check(w > 0 && w <= limits.maxTextureSize &&
            h > 0 && h <= limits.maxTextureSize,
      'invalid texture shape');

      // check wrap mode
      if (info.wrapS !== GL_CLAMP_TO_EDGE || info.wrapT !== GL_CLAMP_TO_EDGE) {
        check(isPow2(w) && isPow2(h),
          'incompatible wrap mode for texture, both width and height must be power of 2');
      }

      if (mipData.mipmask === 1) {
        if (w !== 1 && h !== 1) {
          check(
            info.minFilter !== GL_NEAREST_MIPMAP_NEAREST &&
            info.minFilter !== GL_NEAREST_MIPMAP_LINEAR &&
            info.minFilter !== GL_LINEAR_MIPMAP_NEAREST &&
            info.minFilter !== GL_LINEAR_MIPMAP_LINEAR,
            'min filter requires mipmap');
        }
      } else {
        // texture must be power of 2
        check(isPow2(w) && isPow2(h),
          'texture must be a square power of 2 to support mipmapping');
        check(mipData.mipmask === (w << 1) - 1,
          'missing or incomplete mipmap data');
      }

      if (mipData.type === GL_FLOAT) {
        if (limits.extensions.indexOf('oes_texture_float_linear') < 0) {
          check(info.minFilter === GL_NEAREST && info.magFilter === GL_NEAREST,
            'filter not supported, must enable oes_texture_float_linear');
        }
        check(!info.genMipmaps,
          'mipmap generation not supported with float textures');
      }

      // check image complete
      var mipimages = mipData.images;
      for (i = 0; i < 16; ++i) {
        if (mipimages[i]) {
          var mw = w >> i;
          var mh = h >> i;
          check(mipData.mipmask & (1 << i), 'missing mipmap data');

          var img = mipimages[i];

          check(
            img.width === mw &&
            img.height === mh,
            'invalid shape for mip images');

          check(
            img.format === mipData.format &&
            img.internalformat === mipData.internalformat &&
            img.type === mipData.type,
            'incompatible type for mip image');

          if (img.compressed) ; else if (img.data) {
            // check(img.data.byteLength === mw * mh *
            // Math.max(pixelSize(img.type, c), img.unpackAlignment),
            var rowSize = Math.ceil(pixelSize(img.type, c) * mw / img.unpackAlignment) * img.unpackAlignment;
            check(img.data.byteLength === rowSize * mh,
              'invalid data for image, buffer size is inconsistent with image format');
          } else if (img.element) ; else if (img.copy) ;
        } else if (!info.genMipmaps) {
          check((mipData.mipmask & (1 << i)) === 0, 'extra mipmap data');
        }
      }

      if (mipData.compressed) {
        check(!info.genMipmaps,
          'mipmap generation for compressed images not supported');
      }
    }

    function checkTextureCube (texture, info, faces, limits) {
      var w = texture.width;
      var h = texture.height;
      var c = texture.channels;

      // Check texture shape
      check(
        w > 0 && w <= limits.maxTextureSize && h > 0 && h <= limits.maxTextureSize,
        'invalid texture shape');
      check(
        w === h,
        'cube map must be square');
      check(
        info.wrapS === GL_CLAMP_TO_EDGE && info.wrapT === GL_CLAMP_TO_EDGE,
        'wrap mode not supported by cube map');

      for (var i = 0; i < faces.length; ++i) {
        var face = faces[i];
        check(
          face.width === w && face.height === h,
          'inconsistent cube map face shape');

        if (info.genMipmaps) {
          check(!face.compressed,
            'can not generate mipmap for compressed textures');
          check(face.mipmask === 1,
            'can not specify mipmaps and generate mipmaps');
        }

        var mipmaps = face.images;
        for (var j = 0; j < 16; ++j) {
          var img = mipmaps[j];
          if (img) {
            var mw = w >> j;
            var mh = h >> j;
            check(face.mipmask & (1 << j), 'missing mipmap data');
            check(
              img.width === mw &&
              img.height === mh,
              'invalid shape for mip images');
            check(
              img.format === texture.format &&
              img.internalformat === texture.internalformat &&
              img.type === texture.type,
              'incompatible type for mip image');

            if (img.compressed) ; else if (img.data) {
              check(img.data.byteLength === mw * mh *
                Math.max(pixelSize(img.type, c), img.unpackAlignment),
              'invalid data for image, buffer size is inconsistent with image format');
            } else if (img.element) ; else if (img.copy) ;
          }
        }
      }
    }

    var check$1 = extend(check, {
      optional: checkOptional,
      raise: raise,
      commandRaise: commandRaise,
      command: checkCommand,
      parameter: checkParameter,
      commandParameter: checkParameterCommand,
      constructor: checkConstructor,
      type: checkTypeOf,
      commandType: checkCommandType,
      isTypedArray: checkIsTypedArray,
      nni: checkNonNegativeInt,
      oneOf: checkOneOf,
      shaderError: checkShaderError,
      linkError: checkLinkError,
      callSite: guessCallSite,
      saveCommandRef: saveCommandRef,
      saveDrawInfo: saveDrawCommandInfo,
      framebufferFormat: checkFramebufferFormat,
      guessCommand: guessCommand,
      texture2D: checkTexture2D,
      textureCube: checkTextureCube
    });

    var VARIABLE_COUNTER = 0;

    var DYN_FUNC = 0;
    var DYN_CONSTANT = 5;
    var DYN_ARRAY = 6;

    function DynamicVariable (type, data) {
      this.id = (VARIABLE_COUNTER++);
      this.type = type;
      this.data = data;
    }

    function escapeStr (str) {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    function splitParts (str) {
      if (str.length === 0) {
        return []
      }

      var firstChar = str.charAt(0);
      var lastChar = str.charAt(str.length - 1);

      if (str.length > 1 &&
          firstChar === lastChar &&
          (firstChar === '"' || firstChar === "'")) {
        return ['"' + escapeStr(str.substr(1, str.length - 2)) + '"']
      }

      var parts = /\[(false|true|null|\d+|'[^']*'|"[^"]*")\]/.exec(str);
      if (parts) {
        return (
          splitParts(str.substr(0, parts.index))
            .concat(splitParts(parts[1]))
            .concat(splitParts(str.substr(parts.index + parts[0].length)))
        )
      }

      var subparts = str.split('.');
      if (subparts.length === 1) {
        return ['"' + escapeStr(str) + '"']
      }

      var result = [];
      for (var i = 0; i < subparts.length; ++i) {
        result = result.concat(splitParts(subparts[i]));
      }
      return result
    }

    function toAccessorString (str) {
      return '[' + splitParts(str).join('][') + ']'
    }

    function defineDynamic (type, data) {
      return new DynamicVariable(type, toAccessorString(data + ''))
    }

    function isDynamic (x) {
      return (typeof x === 'function' && !x._reglType) || (x instanceof DynamicVariable)
    }

    function unbox (x, path) {
      if (typeof x === 'function') {
        return new DynamicVariable(DYN_FUNC, x)
      } else if (typeof x === 'number' || typeof x === 'boolean') {
        return new DynamicVariable(DYN_CONSTANT, x)
      } else if (Array.isArray(x)) {
        return new DynamicVariable(DYN_ARRAY, x.map((y, i) => unbox(y, path + '[' + i + ']')))
      } else if (x instanceof DynamicVariable) {
        return x
      }
      check$1(false, 'invalid option type in uniform ' + path);
    }

    var dynamic = {
      DynamicVariable: DynamicVariable,
      define: defineDynamic,
      isDynamic: isDynamic,
      unbox: unbox,
      accessor: toAccessorString
    };

    /* globals requestAnimationFrame, cancelAnimationFrame */
    var raf = {
      next: typeof requestAnimationFrame === 'function'
        ? function (cb) { return requestAnimationFrame(cb) }
        : function (cb) { return setTimeout(cb, 16) },
      cancel: typeof cancelAnimationFrame === 'function'
        ? function (raf) { return cancelAnimationFrame(raf) }
        : clearTimeout
    };

    /* globals performance */
    var clock = (typeof performance !== 'undefined' && performance.now)
        ? function () { return performance.now() }
        : function () { return +(new Date()) };

    function createStringStore () {
      var stringIds = { '': 0 };
      var stringValues = [''];
      return {
        id: function (str) {
          var result = stringIds[str];
          if (result) {
            return result
          }
          result = stringIds[str] = stringValues.length;
          stringValues.push(str);
          return result
        },

        str: function (id) {
          return stringValues[id]
        }
      }
    }

    // Context and canvas creation helper functions
    function createCanvas (element, onDone, pixelRatio) {
      var canvas = document.createElement('canvas');
      extend(canvas.style, {
        border: 0,
        margin: 0,
        padding: 0,
        top: 0,
        left: 0
      });
      element.appendChild(canvas);

      if (element === document.body) {
        canvas.style.position = 'absolute';
        extend(element.style, {
          margin: 0,
          padding: 0
        });
      }

      function resize () {
        var w = window.innerWidth;
        var h = window.innerHeight;
        if (element !== document.body) {
          var bounds = element.getBoundingClientRect();
          w = bounds.right - bounds.left;
          h = bounds.bottom - bounds.top;
        }
        canvas.width = pixelRatio * w;
        canvas.height = pixelRatio * h;
        extend(canvas.style, {
          width: w + 'px',
          height: h + 'px'
        });
      }

      var resizeObserver;
      if (element !== document.body && typeof ResizeObserver === 'function') {
        // ignore 'ResizeObserver' is not defined
        // eslint-disable-next-line
        resizeObserver = new ResizeObserver(function () {
          // setTimeout to avoid flicker
          setTimeout(resize);
        });
        resizeObserver.observe(element);
      } else {
        window.addEventListener('resize', resize, false);
      }

      function onDestroy () {
        if (resizeObserver) {
          resizeObserver.disconnect();
        } else {
          window.removeEventListener('resize', resize);
        }
        element.removeChild(canvas);
      }

      resize();

      return {
        canvas: canvas,
        onDestroy: onDestroy
      }
    }

    function createContext (canvas, contextAttributes) {
      function get (name) {
        try {
          return canvas.getContext(name, contextAttributes)
        } catch (e) {
          return null
        }
      }
      return (
        get('webgl') ||
        get('experimental-webgl') ||
        get('webgl-experimental')
      )
    }

    function isHTMLElement (obj) {
      return (
        typeof obj.nodeName === 'string' &&
        typeof obj.appendChild === 'function' &&
        typeof obj.getBoundingClientRect === 'function'
      )
    }

    function isWebGLContext (obj) {
      return (
        typeof obj.drawArrays === 'function' ||
        typeof obj.drawElements === 'function'
      )
    }

    function parseExtensions (input) {
      if (typeof input === 'string') {
        return input.split()
      }
      check$1(Array.isArray(input), 'invalid extension array');
      return input
    }

    function getElement (desc) {
      if (typeof desc === 'string') {
        check$1(typeof document !== 'undefined', 'not supported outside of DOM');
        return document.querySelector(desc)
      }
      return desc
    }

    function parseArgs (args_) {
      var args = args_ || {};
      var element, container, canvas, gl;
      var contextAttributes = {};
      var extensions = [];
      var optionalExtensions = [];
      var pixelRatio = (typeof window === 'undefined' ? 1 : window.devicePixelRatio);
      var profile = false;
      var onDone = function (err) {
        if (err) {
          check$1.raise(err);
        }
      };
      var onDestroy = function () {};
      if (typeof args === 'string') {
        check$1(
          typeof document !== 'undefined',
          'selector queries only supported in DOM enviroments');
        element = document.querySelector(args);
        check$1(element, 'invalid query string for element');
      } else if (typeof args === 'object') {
        if (isHTMLElement(args)) {
          element = args;
        } else if (isWebGLContext(args)) {
          gl = args;
          canvas = gl.canvas;
        } else {
          check$1.constructor(args);
          if ('gl' in args) {
            gl = args.gl;
          } else if ('canvas' in args) {
            canvas = getElement(args.canvas);
          } else if ('container' in args) {
            container = getElement(args.container);
          }
          if ('attributes' in args) {
            contextAttributes = args.attributes;
            check$1.type(contextAttributes, 'object', 'invalid context attributes');
          }
          if ('extensions' in args) {
            extensions = parseExtensions(args.extensions);
          }
          if ('optionalExtensions' in args) {
            optionalExtensions = parseExtensions(args.optionalExtensions);
          }
          if ('onDone' in args) {
            check$1.type(
              args.onDone, 'function',
              'invalid or missing onDone callback');
            onDone = args.onDone;
          }
          if ('profile' in args) {
            profile = !!args.profile;
          }
          if ('pixelRatio' in args) {
            pixelRatio = +args.pixelRatio;
            check$1(pixelRatio > 0, 'invalid pixel ratio');
          }
        }
      } else {
        check$1.raise('invalid arguments to regl');
      }

      if (element) {
        if (element.nodeName.toLowerCase() === 'canvas') {
          canvas = element;
        } else {
          container = element;
        }
      }

      if (!gl) {
        if (!canvas) {
          check$1(
            typeof document !== 'undefined',
            'must manually specify webgl context outside of DOM environments');
          var result = createCanvas(container || document.body, onDone, pixelRatio);
          if (!result) {
            return null
          }
          canvas = result.canvas;
          onDestroy = result.onDestroy;
        }
        // workaround for chromium bug, premultiplied alpha value is platform dependent
        if (contextAttributes.premultipliedAlpha === undefined) contextAttributes.premultipliedAlpha = true;
        gl = createContext(canvas, contextAttributes);
      }

      if (!gl) {
        onDestroy();
        onDone('webgl not supported, try upgrading your browser or graphics drivers http://get.webgl.org');
        return null
      }

      return {
        gl: gl,
        canvas: canvas,
        container: container,
        extensions: extensions,
        optionalExtensions: optionalExtensions,
        pixelRatio: pixelRatio,
        profile: profile,
        onDone: onDone,
        onDestroy: onDestroy
      }
    }

    function createExtensionCache (gl, config) {
      var extensions = {};

      function tryLoadExtension (name_) {
        check$1.type(name_, 'string', 'extension name must be string');
        var name = name_.toLowerCase();
        var ext;
        try {
          ext = extensions[name] = gl.getExtension(name);
        } catch (e) {}
        return !!ext
      }

      for (var i = 0; i < config.extensions.length; ++i) {
        var name = config.extensions[i];
        if (!tryLoadExtension(name)) {
          config.onDestroy();
          config.onDone('"' + name + '" extension is not supported by the current WebGL context, try upgrading your system or a different browser');
          return null
        }
      }

      config.optionalExtensions.forEach(tryLoadExtension);

      return {
        extensions: extensions,
        restore: function () {
          Object.keys(extensions).forEach(function (name) {
            if (extensions[name] && !tryLoadExtension(name)) {
              throw new Error('(regl): error restoring extension ' + name)
            }
          });
        }
      }
    }

    function loop (n, f) {
      var result = Array(n);
      for (var i = 0; i < n; ++i) {
        result[i] = f(i);
      }
      return result
    }

    var GL_BYTE$1 = 5120;
    var GL_UNSIGNED_BYTE$2 = 5121;
    var GL_SHORT$1 = 5122;
    var GL_UNSIGNED_SHORT$1 = 5123;
    var GL_INT$1 = 5124;
    var GL_UNSIGNED_INT$1 = 5125;
    var GL_FLOAT$2 = 5126;

    function nextPow16 (v) {
      for (var i = 16; i <= (1 << 28); i *= 16) {
        if (v <= i) {
          return i
        }
      }
      return 0
    }

    function log2 (v) {
      var r, shift;
      r = (v > 0xFFFF) << 4;
      v >>>= r;
      shift = (v > 0xFF) << 3;
      v >>>= shift; r |= shift;
      shift = (v > 0xF) << 2;
      v >>>= shift; r |= shift;
      shift = (v > 0x3) << 1;
      v >>>= shift; r |= shift;
      return r | (v >> 1)
    }

    function createPool () {
      var bufferPool = loop(8, function () {
        return []
      });

      function alloc (n) {
        var sz = nextPow16(n);
        var bin = bufferPool[log2(sz) >> 2];
        if (bin.length > 0) {
          return bin.pop()
        }
        return new ArrayBuffer(sz)
      }

      function free (buf) {
        bufferPool[log2(buf.byteLength) >> 2].push(buf);
      }

      function allocType (type, n) {
        var result = null;
        switch (type) {
          case GL_BYTE$1:
            result = new Int8Array(alloc(n), 0, n);
            break
          case GL_UNSIGNED_BYTE$2:
            result = new Uint8Array(alloc(n), 0, n);
            break
          case GL_SHORT$1:
            result = new Int16Array(alloc(2 * n), 0, n);
            break
          case GL_UNSIGNED_SHORT$1:
            result = new Uint16Array(alloc(2 * n), 0, n);
            break
          case GL_INT$1:
            result = new Int32Array(alloc(4 * n), 0, n);
            break
          case GL_UNSIGNED_INT$1:
            result = new Uint32Array(alloc(4 * n), 0, n);
            break
          case GL_FLOAT$2:
            result = new Float32Array(alloc(4 * n), 0, n);
            break
          default:
            return null
        }
        if (result.length !== n) {
          return result.subarray(0, n)
        }
        return result
      }

      function freeType (array) {
        free(array.buffer);
      }

      return {
        alloc: alloc,
        free: free,
        allocType: allocType,
        freeType: freeType
      }
    }

    var pool = createPool();

    // zero pool for initial zero data
    pool.zero = createPool();

    var GL_SUBPIXEL_BITS = 0x0D50;
    var GL_RED_BITS = 0x0D52;
    var GL_GREEN_BITS = 0x0D53;
    var GL_BLUE_BITS = 0x0D54;
    var GL_ALPHA_BITS = 0x0D55;
    var GL_DEPTH_BITS = 0x0D56;
    var GL_STENCIL_BITS = 0x0D57;

    var GL_ALIASED_POINT_SIZE_RANGE = 0x846D;
    var GL_ALIASED_LINE_WIDTH_RANGE = 0x846E;

    var GL_MAX_TEXTURE_SIZE = 0x0D33;
    var GL_MAX_VIEWPORT_DIMS = 0x0D3A;
    var GL_MAX_VERTEX_ATTRIBS = 0x8869;
    var GL_MAX_VERTEX_UNIFORM_VECTORS = 0x8DFB;
    var GL_MAX_VARYING_VECTORS = 0x8DFC;
    var GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0x8B4D;
    var GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS = 0x8B4C;
    var GL_MAX_TEXTURE_IMAGE_UNITS = 0x8872;
    var GL_MAX_FRAGMENT_UNIFORM_VECTORS = 0x8DFD;
    var GL_MAX_CUBE_MAP_TEXTURE_SIZE = 0x851C;
    var GL_MAX_RENDERBUFFER_SIZE = 0x84E8;

    var GL_VENDOR = 0x1F00;
    var GL_RENDERER = 0x1F01;
    var GL_VERSION = 0x1F02;
    var GL_SHADING_LANGUAGE_VERSION = 0x8B8C;

    var GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT = 0x84FF;

    var GL_MAX_COLOR_ATTACHMENTS_WEBGL = 0x8CDF;
    var GL_MAX_DRAW_BUFFERS_WEBGL = 0x8824;

    var GL_TEXTURE_2D = 0x0DE1;
    var GL_TEXTURE_CUBE_MAP = 0x8513;
    var GL_TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;
    var GL_TEXTURE0 = 0x84C0;
    var GL_RGBA = 0x1908;
    var GL_FLOAT$1 = 0x1406;
    var GL_UNSIGNED_BYTE$1 = 0x1401;
    var GL_FRAMEBUFFER = 0x8D40;
    var GL_FRAMEBUFFER_COMPLETE = 0x8CD5;
    var GL_COLOR_ATTACHMENT0 = 0x8CE0;
    var GL_COLOR_BUFFER_BIT$1 = 0x4000;

    var wrapLimits = function (gl, extensions) {
      var maxAnisotropic = 1;
      if (extensions.ext_texture_filter_anisotropic) {
        maxAnisotropic = gl.getParameter(GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      }

      var maxDrawbuffers = 1;
      var maxColorAttachments = 1;
      if (extensions.webgl_draw_buffers) {
        maxDrawbuffers = gl.getParameter(GL_MAX_DRAW_BUFFERS_WEBGL);
        maxColorAttachments = gl.getParameter(GL_MAX_COLOR_ATTACHMENTS_WEBGL);
      }

      // detect if reading float textures is available (Safari doesn't support)
      var readFloat = !!extensions.oes_texture_float;
      if (readFloat) {
        var readFloatTexture = gl.createTexture();
        gl.bindTexture(GL_TEXTURE_2D, readFloatTexture);
        gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_FLOAT$1, null);

        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(GL_FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, readFloatTexture, 0);
        gl.bindTexture(GL_TEXTURE_2D, null);

        if (gl.checkFramebufferStatus(GL_FRAMEBUFFER) !== GL_FRAMEBUFFER_COMPLETE) readFloat = false;

        else {
          gl.viewport(0, 0, 1, 1);
          gl.clearColor(1.0, 0.0, 0.0, 1.0);
          gl.clear(GL_COLOR_BUFFER_BIT$1);
          var pixels = pool.allocType(GL_FLOAT$1, 4);
          gl.readPixels(0, 0, 1, 1, GL_RGBA, GL_FLOAT$1, pixels);

          if (gl.getError()) readFloat = false;
          else {
            gl.deleteFramebuffer(fbo);
            gl.deleteTexture(readFloatTexture);

            readFloat = pixels[0] === 1.0;
          }

          pool.freeType(pixels);
        }
      }

      // detect non power of two cube textures support (IE doesn't support)
      var isIE = typeof navigator !== 'undefined' && (/MSIE/.test(navigator.userAgent) || /Trident\//.test(navigator.appVersion) || /Edge/.test(navigator.userAgent));

      var npotTextureCube = true;

      if (!isIE) {
        var cubeTexture = gl.createTexture();
        var data = pool.allocType(GL_UNSIGNED_BYTE$1, 36);
        gl.activeTexture(GL_TEXTURE0);
        gl.bindTexture(GL_TEXTURE_CUBE_MAP, cubeTexture);
        gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X, 0, GL_RGBA, 3, 3, 0, GL_RGBA, GL_UNSIGNED_BYTE$1, data);
        pool.freeType(data);
        gl.bindTexture(GL_TEXTURE_CUBE_MAP, null);
        gl.deleteTexture(cubeTexture);
        npotTextureCube = !gl.getError();
      }

      return {
        // drawing buffer bit depth
        colorBits: [
          gl.getParameter(GL_RED_BITS),
          gl.getParameter(GL_GREEN_BITS),
          gl.getParameter(GL_BLUE_BITS),
          gl.getParameter(GL_ALPHA_BITS)
        ],
        depthBits: gl.getParameter(GL_DEPTH_BITS),
        stencilBits: gl.getParameter(GL_STENCIL_BITS),
        subpixelBits: gl.getParameter(GL_SUBPIXEL_BITS),

        // supported extensions
        extensions: Object.keys(extensions).filter(function (ext) {
          return !!extensions[ext]
        }),

        // max aniso samples
        maxAnisotropic: maxAnisotropic,

        // max draw buffers
        maxDrawbuffers: maxDrawbuffers,
        maxColorAttachments: maxColorAttachments,

        // point and line size ranges
        pointSizeDims: gl.getParameter(GL_ALIASED_POINT_SIZE_RANGE),
        lineWidthDims: gl.getParameter(GL_ALIASED_LINE_WIDTH_RANGE),
        maxViewportDims: gl.getParameter(GL_MAX_VIEWPORT_DIMS),
        maxCombinedTextureUnits: gl.getParameter(GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        maxCubeMapSize: gl.getParameter(GL_MAX_CUBE_MAP_TEXTURE_SIZE),
        maxRenderbufferSize: gl.getParameter(GL_MAX_RENDERBUFFER_SIZE),
        maxTextureUnits: gl.getParameter(GL_MAX_TEXTURE_IMAGE_UNITS),
        maxTextureSize: gl.getParameter(GL_MAX_TEXTURE_SIZE),
        maxAttributes: gl.getParameter(GL_MAX_VERTEX_ATTRIBS),
        maxVertexUniforms: gl.getParameter(GL_MAX_VERTEX_UNIFORM_VECTORS),
        maxVertexTextureUnits: gl.getParameter(GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        maxVaryingVectors: gl.getParameter(GL_MAX_VARYING_VECTORS),
        maxFragmentUniforms: gl.getParameter(GL_MAX_FRAGMENT_UNIFORM_VECTORS),

        // vendor info
        glsl: gl.getParameter(GL_SHADING_LANGUAGE_VERSION),
        renderer: gl.getParameter(GL_RENDERER),
        vendor: gl.getParameter(GL_VENDOR),
        version: gl.getParameter(GL_VERSION),

        // quirks
        readFloat: readFloat,
        npotTextureCube: npotTextureCube
      }
    };

    function isNDArrayLike (obj) {
      return (
        !!obj &&
        typeof obj === 'object' &&
        Array.isArray(obj.shape) &&
        Array.isArray(obj.stride) &&
        typeof obj.offset === 'number' &&
        obj.shape.length === obj.stride.length &&
        (Array.isArray(obj.data) ||
          isTypedArray(obj.data)))
    }

    var values = function (obj) {
      return Object.keys(obj).map(function (key) { return obj[key] })
    };

    var flattenUtils = {
      shape: arrayShape$1,
      flatten: flattenArray
    };

    function flatten1D (array, nx, out) {
      for (var i = 0; i < nx; ++i) {
        out[i] = array[i];
      }
    }

    function flatten2D (array, nx, ny, out) {
      var ptr = 0;
      for (var i = 0; i < nx; ++i) {
        var row = array[i];
        for (var j = 0; j < ny; ++j) {
          out[ptr++] = row[j];
        }
      }
    }

    function flatten3D (array, nx, ny, nz, out, ptr_) {
      var ptr = ptr_;
      for (var i = 0; i < nx; ++i) {
        var row = array[i];
        for (var j = 0; j < ny; ++j) {
          var col = row[j];
          for (var k = 0; k < nz; ++k) {
            out[ptr++] = col[k];
          }
        }
      }
    }

    function flattenRec (array, shape, level, out, ptr) {
      var stride = 1;
      for (var i = level + 1; i < shape.length; ++i) {
        stride *= shape[i];
      }
      var n = shape[level];
      if (shape.length - level === 4) {
        var nx = shape[level + 1];
        var ny = shape[level + 2];
        var nz = shape[level + 3];
        for (i = 0; i < n; ++i) {
          flatten3D(array[i], nx, ny, nz, out, ptr);
          ptr += stride;
        }
      } else {
        for (i = 0; i < n; ++i) {
          flattenRec(array[i], shape, level + 1, out, ptr);
          ptr += stride;
        }
      }
    }

    function flattenArray (array, shape, type, out_) {
      var sz = 1;
      if (shape.length) {
        for (var i = 0; i < shape.length; ++i) {
          sz *= shape[i];
        }
      } else {
        sz = 0;
      }
      var out = out_ || pool.allocType(type, sz);
      switch (shape.length) {
        case 0:
          break
        case 1:
          flatten1D(array, shape[0], out);
          break
        case 2:
          flatten2D(array, shape[0], shape[1], out);
          break
        case 3:
          flatten3D(array, shape[0], shape[1], shape[2], out, 0);
          break
        default:
          flattenRec(array, shape, 0, out, 0);
      }
      return out
    }

    function arrayShape$1 (array_) {
      var shape = [];
      for (var array = array_; array.length; array = array[0]) {
        shape.push(array.length);
      }
      return shape
    }

    var arrayTypes =  {
    	"[object Int8Array]": 5120,
    	"[object Int16Array]": 5122,
    	"[object Int32Array]": 5124,
    	"[object Uint8Array]": 5121,
    	"[object Uint8ClampedArray]": 5121,
    	"[object Uint16Array]": 5123,
    	"[object Uint32Array]": 5125,
    	"[object Float32Array]": 5126,
    	"[object Float64Array]": 5121,
    	"[object ArrayBuffer]": 5121
    };

    var int8 = 5120;
    var int16 = 5122;
    var int32 = 5124;
    var uint8 = 5121;
    var uint16 = 5123;
    var uint32 = 5125;
    var float = 5126;
    var float32 = 5126;
    var glTypes = {
    	int8: int8,
    	int16: int16,
    	int32: int32,
    	uint8: uint8,
    	uint16: uint16,
    	uint32: uint32,
    	float: float,
    	float32: float32
    };

    var dynamic$1 = 35048;
    var stream = 35040;
    var usageTypes = {
    	dynamic: dynamic$1,
    	stream: stream,
    	"static": 35044
    };

    var arrayFlatten = flattenUtils.flatten;
    var arrayShape = flattenUtils.shape;

    var GL_STATIC_DRAW = 0x88E4;
    var GL_STREAM_DRAW = 0x88E0;

    var GL_UNSIGNED_BYTE$3 = 5121;
    var GL_FLOAT$3 = 5126;

    var DTYPES_SIZES = [];
    DTYPES_SIZES[5120] = 1; // int8
    DTYPES_SIZES[5122] = 2; // int16
    DTYPES_SIZES[5124] = 4; // int32
    DTYPES_SIZES[5121] = 1; // uint8
    DTYPES_SIZES[5123] = 2; // uint16
    DTYPES_SIZES[5125] = 4; // uint32
    DTYPES_SIZES[5126] = 4; // float32

    function typedArrayCode (data) {
      return arrayTypes[Object.prototype.toString.call(data)] | 0
    }

    function copyArray (out, inp) {
      for (var i = 0; i < inp.length; ++i) {
        out[i] = inp[i];
      }
    }

    function transpose (
      result, data, shapeX, shapeY, strideX, strideY, offset) {
      var ptr = 0;
      for (var i = 0; i < shapeX; ++i) {
        for (var j = 0; j < shapeY; ++j) {
          result[ptr++] = data[strideX * i + strideY * j + offset];
        }
      }
    }

    function wrapBufferState (gl, stats, config, destroyBuffer) {
      var bufferCount = 0;
      var bufferSet = {};

      function REGLBuffer (type) {
        this.id = bufferCount++;
        this.buffer = gl.createBuffer();
        this.type = type;
        this.usage = GL_STATIC_DRAW;
        this.byteLength = 0;
        this.dimension = 1;
        this.dtype = GL_UNSIGNED_BYTE$3;

        this.persistentData = null;

        if (config.profile) {
          this.stats = { size: 0 };
        }
      }

      REGLBuffer.prototype.bind = function () {
        gl.bindBuffer(this.type, this.buffer);
      };

      REGLBuffer.prototype.destroy = function () {
        destroy(this);
      };

      var streamPool = [];

      function createStream (type, data) {
        var buffer = streamPool.pop();
        if (!buffer) {
          buffer = new REGLBuffer(type);
        }
        buffer.bind();
        initBufferFromData(buffer, data, GL_STREAM_DRAW, 0, 1, false);
        return buffer
      }

      function destroyStream (stream$$1) {
        streamPool.push(stream$$1);
      }

      function initBufferFromTypedArray (buffer, data, usage) {
        buffer.byteLength = data.byteLength;
        gl.bufferData(buffer.type, data, usage);
      }

      function initBufferFromData (buffer, data, usage, dtype, dimension, persist) {
        var shape;
        buffer.usage = usage;
        if (Array.isArray(data)) {
          buffer.dtype = dtype || GL_FLOAT$3;
          if (data.length > 0) {
            var flatData;
            if (Array.isArray(data[0])) {
              shape = arrayShape(data);
              var dim = 1;
              for (var i = 1; i < shape.length; ++i) {
                dim *= shape[i];
              }
              buffer.dimension = dim;
              flatData = arrayFlatten(data, shape, buffer.dtype);
              initBufferFromTypedArray(buffer, flatData, usage);
              if (persist) {
                buffer.persistentData = flatData;
              } else {
                pool.freeType(flatData);
              }
            } else if (typeof data[0] === 'number') {
              buffer.dimension = dimension;
              var typedData = pool.allocType(buffer.dtype, data.length);
              copyArray(typedData, data);
              initBufferFromTypedArray(buffer, typedData, usage);
              if (persist) {
                buffer.persistentData = typedData;
              } else {
                pool.freeType(typedData);
              }
            } else if (isTypedArray(data[0])) {
              buffer.dimension = data[0].length;
              buffer.dtype = dtype || typedArrayCode(data[0]) || GL_FLOAT$3;
              flatData = arrayFlatten(
                data,
                [data.length, data[0].length],
                buffer.dtype);
              initBufferFromTypedArray(buffer, flatData, usage);
              if (persist) {
                buffer.persistentData = flatData;
              } else {
                pool.freeType(flatData);
              }
            } else {
              check$1.raise('invalid buffer data');
            }
          }
        } else if (isTypedArray(data)) {
          buffer.dtype = dtype || typedArrayCode(data);
          buffer.dimension = dimension;
          initBufferFromTypedArray(buffer, data, usage);
          if (persist) {
            buffer.persistentData = new Uint8Array(new Uint8Array(data.buffer));
          }
        } else if (isNDArrayLike(data)) {
          shape = data.shape;
          var stride = data.stride;
          var offset = data.offset;

          var shapeX = 0;
          var shapeY = 0;
          var strideX = 0;
          var strideY = 0;
          if (shape.length === 1) {
            shapeX = shape[0];
            shapeY = 1;
            strideX = stride[0];
            strideY = 0;
          } else if (shape.length === 2) {
            shapeX = shape[0];
            shapeY = shape[1];
            strideX = stride[0];
            strideY = stride[1];
          } else {
            check$1.raise('invalid shape');
          }

          buffer.dtype = dtype || typedArrayCode(data.data) || GL_FLOAT$3;
          buffer.dimension = shapeY;

          var transposeData = pool.allocType(buffer.dtype, shapeX * shapeY);
          transpose(transposeData,
            data.data,
            shapeX, shapeY,
            strideX, strideY,
            offset);
          initBufferFromTypedArray(buffer, transposeData, usage);
          if (persist) {
            buffer.persistentData = transposeData;
          } else {
            pool.freeType(transposeData);
          }
        } else if (data instanceof ArrayBuffer) {
          buffer.dtype = GL_UNSIGNED_BYTE$3;
          buffer.dimension = dimension;
          initBufferFromTypedArray(buffer, data, usage);
          if (persist) {
            buffer.persistentData = new Uint8Array(new Uint8Array(data));
          }
        } else {
          check$1.raise('invalid buffer data');
        }
      }

      function destroy (buffer) {
        stats.bufferCount--;

        // remove attribute link
        destroyBuffer(buffer);

        var handle = buffer.buffer;
        check$1(handle, 'buffer must not be deleted already');
        gl.deleteBuffer(handle);
        buffer.buffer = null;
        delete bufferSet[buffer.id];
      }

      function createBuffer (options, type, deferInit, persistent) {
        stats.bufferCount++;

        var buffer = new REGLBuffer(type);
        bufferSet[buffer.id] = buffer;

        function reglBuffer (options) {
          var usage = GL_STATIC_DRAW;
          var data = null;
          var byteLength = 0;
          var dtype = 0;
          var dimension = 1;
          if (Array.isArray(options) ||
              isTypedArray(options) ||
              isNDArrayLike(options) ||
              options instanceof ArrayBuffer) {
            data = options;
          } else if (typeof options === 'number') {
            byteLength = options | 0;
          } else if (options) {
            check$1.type(
              options, 'object',
              'buffer arguments must be an object, a number or an array');

            if ('data' in options) {
              check$1(
                data === null ||
                Array.isArray(data) ||
                isTypedArray(data) ||
                isNDArrayLike(data),
                'invalid data for buffer');
              data = options.data;
            }

            if ('usage' in options) {
              check$1.parameter(options.usage, usageTypes, 'invalid buffer usage');
              usage = usageTypes[options.usage];
            }

            if ('type' in options) {
              check$1.parameter(options.type, glTypes, 'invalid buffer type');
              dtype = glTypes[options.type];
            }

            if ('dimension' in options) {
              check$1.type(options.dimension, 'number', 'invalid dimension');
              dimension = options.dimension | 0;
            }

            if ('length' in options) {
              check$1.nni(byteLength, 'buffer length must be a nonnegative integer');
              byteLength = options.length | 0;
            }
          }

          buffer.bind();
          if (!data) {
            // #475
            if (byteLength) gl.bufferData(buffer.type, byteLength, usage);
            buffer.dtype = dtype || GL_UNSIGNED_BYTE$3;
            buffer.usage = usage;
            buffer.dimension = dimension;
            buffer.byteLength = byteLength;
          } else {
            initBufferFromData(buffer, data, usage, dtype, dimension, persistent);
          }

          if (config.profile) {
            buffer.stats.size = buffer.byteLength * DTYPES_SIZES[buffer.dtype];
          }

          return reglBuffer
        }

        function setSubData (data, offset) {
          check$1(offset + data.byteLength <= buffer.byteLength,
            'invalid buffer subdata call, buffer is too small. ' + ' Can\'t write data of size ' + data.byteLength + ' starting from offset ' + offset + ' to a buffer of size ' + buffer.byteLength);

          gl.bufferSubData(buffer.type, offset, data);
        }

        function subdata (data, offset_) {
          var offset = (offset_ || 0) | 0;
          var shape;
          buffer.bind();
          if (isTypedArray(data) || data instanceof ArrayBuffer) {
            setSubData(data, offset);
          } else if (Array.isArray(data)) {
            if (data.length > 0) {
              if (typeof data[0] === 'number') {
                var converted = pool.allocType(buffer.dtype, data.length);
                copyArray(converted, data);
                setSubData(converted, offset);
                pool.freeType(converted);
              } else if (Array.isArray(data[0]) || isTypedArray(data[0])) {
                shape = arrayShape(data);
                var flatData = arrayFlatten(data, shape, buffer.dtype);
                setSubData(flatData, offset);
                pool.freeType(flatData);
              } else {
                check$1.raise('invalid buffer data');
              }
            }
          } else if (isNDArrayLike(data)) {
            shape = data.shape;
            var stride = data.stride;

            var shapeX = 0;
            var shapeY = 0;
            var strideX = 0;
            var strideY = 0;
            if (shape.length === 1) {
              shapeX = shape[0];
              shapeY = 1;
              strideX = stride[0];
              strideY = 0;
            } else if (shape.length === 2) {
              shapeX = shape[0];
              shapeY = shape[1];
              strideX = stride[0];
              strideY = stride[1];
            } else {
              check$1.raise('invalid shape');
            }
            var dtype = Array.isArray(data.data)
              ? buffer.dtype
              : typedArrayCode(data.data);

            var transposeData = pool.allocType(dtype, shapeX * shapeY);
            transpose(transposeData,
              data.data,
              shapeX, shapeY,
              strideX, strideY,
              data.offset);
            setSubData(transposeData, offset);
            pool.freeType(transposeData);
          } else {
            check$1.raise('invalid data for buffer subdata');
          }
          return reglBuffer
        }

        if (!deferInit) {
          reglBuffer(options);
        }

        reglBuffer._reglType = 'buffer';
        reglBuffer._buffer = buffer;
        reglBuffer.subdata = subdata;
        if (config.profile) {
          reglBuffer.stats = buffer.stats;
        }
        reglBuffer.destroy = function () { destroy(buffer); };

        return reglBuffer
      }

      function restoreBuffers () {
        values(bufferSet).forEach(function (buffer) {
          buffer.buffer = gl.createBuffer();
          gl.bindBuffer(buffer.type, buffer.buffer);
          gl.bufferData(
            buffer.type, buffer.persistentData || buffer.byteLength, buffer.usage);
        });
      }

      if (config.profile) {
        stats.getTotalBufferSize = function () {
          var total = 0;
          // TODO: Right now, the streams are not part of the total count.
          Object.keys(bufferSet).forEach(function (key) {
            total += bufferSet[key].stats.size;
          });
          return total
        };
      }

      return {
        create: createBuffer,

        createStream: createStream,
        destroyStream: destroyStream,

        clear: function () {
          values(bufferSet).forEach(destroy);
          streamPool.forEach(destroy);
        },

        getBuffer: function (wrapper) {
          if (wrapper && wrapper._buffer instanceof REGLBuffer) {
            return wrapper._buffer
          }
          return null
        },

        restore: restoreBuffers,

        _initBuffer: initBufferFromData
      }
    }

    var points = 0;
    var point = 0;
    var lines = 1;
    var line = 1;
    var triangles = 4;
    var triangle = 4;
    var primTypes = {
    	points: points,
    	point: point,
    	lines: lines,
    	line: line,
    	triangles: triangles,
    	triangle: triangle,
    	"line loop": 2,
    	"line strip": 3,
    	"triangle strip": 5,
    	"triangle fan": 6
    };

    var GL_POINTS = 0;
    var GL_LINES = 1;
    var GL_TRIANGLES = 4;

    var GL_BYTE$2 = 5120;
    var GL_UNSIGNED_BYTE$4 = 5121;
    var GL_SHORT$2 = 5122;
    var GL_UNSIGNED_SHORT$2 = 5123;
    var GL_INT$2 = 5124;
    var GL_UNSIGNED_INT$2 = 5125;

    var GL_ELEMENT_ARRAY_BUFFER = 34963;

    var GL_STREAM_DRAW$1 = 0x88E0;
    var GL_STATIC_DRAW$1 = 0x88E4;

    function wrapElementsState (gl, extensions, bufferState, stats) {
      var elementSet = {};
      var elementCount = 0;

      var elementTypes = {
        'uint8': GL_UNSIGNED_BYTE$4,
        'uint16': GL_UNSIGNED_SHORT$2
      };

      if (extensions.oes_element_index_uint) {
        elementTypes.uint32 = GL_UNSIGNED_INT$2;
      }

      function REGLElementBuffer (buffer) {
        this.id = elementCount++;
        elementSet[this.id] = this;
        this.buffer = buffer;
        this.primType = GL_TRIANGLES;
        this.vertCount = 0;
        this.type = 0;
      }

      REGLElementBuffer.prototype.bind = function () {
        this.buffer.bind();
      };

      var bufferPool = [];

      function createElementStream (data) {
        var result = bufferPool.pop();
        if (!result) {
          result = new REGLElementBuffer(bufferState.create(
            null,
            GL_ELEMENT_ARRAY_BUFFER,
            true,
            false)._buffer);
        }
        initElements(result, data, GL_STREAM_DRAW$1, -1, -1, 0, 0);
        return result
      }

      function destroyElementStream (elements) {
        bufferPool.push(elements);
      }

      function initElements (
        elements,
        data,
        usage,
        prim,
        count,
        byteLength,
        type) {
        elements.buffer.bind();
        var dtype;
        if (data) {
          var predictedType = type;
          if (!type && (
            !isTypedArray(data) ||
             (isNDArrayLike(data) && !isTypedArray(data.data)))) {
            predictedType = extensions.oes_element_index_uint
              ? GL_UNSIGNED_INT$2
              : GL_UNSIGNED_SHORT$2;
          }
          bufferState._initBuffer(
            elements.buffer,
            data,
            usage,
            predictedType,
            3);
        } else {
          gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, byteLength, usage);
          elements.buffer.dtype = dtype || GL_UNSIGNED_BYTE$4;
          elements.buffer.usage = usage;
          elements.buffer.dimension = 3;
          elements.buffer.byteLength = byteLength;
        }

        dtype = type;
        if (!type) {
          switch (elements.buffer.dtype) {
            case GL_UNSIGNED_BYTE$4:
            case GL_BYTE$2:
              dtype = GL_UNSIGNED_BYTE$4;
              break

            case GL_UNSIGNED_SHORT$2:
            case GL_SHORT$2:
              dtype = GL_UNSIGNED_SHORT$2;
              break

            case GL_UNSIGNED_INT$2:
            case GL_INT$2:
              dtype = GL_UNSIGNED_INT$2;
              break

            default:
              check$1.raise('unsupported type for element array');
          }
          elements.buffer.dtype = dtype;
        }
        elements.type = dtype;

        // Check oes_element_index_uint extension
        check$1(
          dtype !== GL_UNSIGNED_INT$2 ||
          !!extensions.oes_element_index_uint,
          '32 bit element buffers not supported, enable oes_element_index_uint first');

        // try to guess default primitive type and arguments
        var vertCount = count;
        if (vertCount < 0) {
          vertCount = elements.buffer.byteLength;
          if (dtype === GL_UNSIGNED_SHORT$2) {
            vertCount >>= 1;
          } else if (dtype === GL_UNSIGNED_INT$2) {
            vertCount >>= 2;
          }
        }
        elements.vertCount = vertCount;

        // try to guess primitive type from cell dimension
        var primType = prim;
        if (prim < 0) {
          primType = GL_TRIANGLES;
          var dimension = elements.buffer.dimension;
          if (dimension === 1) primType = GL_POINTS;
          if (dimension === 2) primType = GL_LINES;
          if (dimension === 3) primType = GL_TRIANGLES;
        }
        elements.primType = primType;
      }

      function destroyElements (elements) {
        stats.elementsCount--;

        check$1(elements.buffer !== null, 'must not double destroy elements');
        delete elementSet[elements.id];
        elements.buffer.destroy();
        elements.buffer = null;
      }

      function createElements (options, persistent) {
        var buffer = bufferState.create(null, GL_ELEMENT_ARRAY_BUFFER, true);
        var elements = new REGLElementBuffer(buffer._buffer);
        stats.elementsCount++;

        function reglElements (options) {
          if (!options) {
            buffer();
            elements.primType = GL_TRIANGLES;
            elements.vertCount = 0;
            elements.type = GL_UNSIGNED_BYTE$4;
          } else if (typeof options === 'number') {
            buffer(options);
            elements.primType = GL_TRIANGLES;
            elements.vertCount = options | 0;
            elements.type = GL_UNSIGNED_BYTE$4;
          } else {
            var data = null;
            var usage = GL_STATIC_DRAW$1;
            var primType = -1;
            var vertCount = -1;
            var byteLength = 0;
            var dtype = 0;
            if (Array.isArray(options) ||
                isTypedArray(options) ||
                isNDArrayLike(options)) {
              data = options;
            } else {
              check$1.type(options, 'object', 'invalid arguments for elements');
              if ('data' in options) {
                data = options.data;
                check$1(
                  Array.isArray(data) ||
                    isTypedArray(data) ||
                    isNDArrayLike(data),
                  'invalid data for element buffer');
              }
              if ('usage' in options) {
                check$1.parameter(
                  options.usage,
                  usageTypes,
                  'invalid element buffer usage');
                usage = usageTypes[options.usage];
              }
              if ('primitive' in options) {
                check$1.parameter(
                  options.primitive,
                  primTypes,
                  'invalid element buffer primitive');
                primType = primTypes[options.primitive];
              }
              if ('count' in options) {
                check$1(
                  typeof options.count === 'number' && options.count >= 0,
                  'invalid vertex count for elements');
                vertCount = options.count | 0;
              }
              if ('type' in options) {
                check$1.parameter(
                  options.type,
                  elementTypes,
                  'invalid buffer type');
                dtype = elementTypes[options.type];
              }
              if ('length' in options) {
                byteLength = options.length | 0;
              } else {
                byteLength = vertCount;
                if (dtype === GL_UNSIGNED_SHORT$2 || dtype === GL_SHORT$2) {
                  byteLength *= 2;
                } else if (dtype === GL_UNSIGNED_INT$2 || dtype === GL_INT$2) {
                  byteLength *= 4;
                }
              }
            }
            initElements(
              elements,
              data,
              usage,
              primType,
              vertCount,
              byteLength,
              dtype);
          }

          return reglElements
        }

        reglElements(options);

        reglElements._reglType = 'elements';
        reglElements._elements = elements;
        reglElements.subdata = function (data, offset) {
          buffer.subdata(data, offset);
          return reglElements
        };
        reglElements.destroy = function () {
          destroyElements(elements);
        };

        return reglElements
      }

      return {
        create: createElements,
        createStream: createElementStream,
        destroyStream: destroyElementStream,
        getElements: function (elements) {
          if (typeof elements === 'function' &&
              elements._elements instanceof REGLElementBuffer) {
            return elements._elements
          }
          return null
        },
        clear: function () {
          values(elementSet).forEach(destroyElements);
        }
      }
    }

    var FLOAT = new Float32Array(1);
    var INT = new Uint32Array(FLOAT.buffer);

    var GL_UNSIGNED_SHORT$4 = 5123;

    function convertToHalfFloat (array) {
      var ushorts = pool.allocType(GL_UNSIGNED_SHORT$4, array.length);

      for (var i = 0; i < array.length; ++i) {
        if (isNaN(array[i])) {
          ushorts[i] = 0xffff;
        } else if (array[i] === Infinity) {
          ushorts[i] = 0x7c00;
        } else if (array[i] === -Infinity) {
          ushorts[i] = 0xfc00;
        } else {
          FLOAT[0] = array[i];
          var x = INT[0];

          var sgn = (x >>> 31) << 15;
          var exp = ((x << 1) >>> 24) - 127;
          var frac = (x >> 13) & ((1 << 10) - 1);

          if (exp < -24) {
            // round non-representable denormals to 0
            ushorts[i] = sgn;
          } else if (exp < -14) {
            // handle denormals
            var s = -14 - exp;
            ushorts[i] = sgn + ((frac + (1 << 10)) >> s);
          } else if (exp > 15) {
            // round overflow to +/- Infinity
            ushorts[i] = sgn + 0x7c00;
          } else {
            // otherwise convert directly
            ushorts[i] = sgn + ((exp + 15) << 10) + frac;
          }
        }
      }

      return ushorts
    }

    function isArrayLike (s) {
      return Array.isArray(s) || isTypedArray(s)
    }

    var isPow2$1 = function (v) {
      return !(v & (v - 1)) && (!!v)
    };

    var GL_COMPRESSED_TEXTURE_FORMATS = 0x86A3;

    var GL_TEXTURE_2D$1 = 0x0DE1;
    var GL_TEXTURE_CUBE_MAP$1 = 0x8513;
    var GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 = 0x8515;

    var GL_RGBA$1 = 0x1908;
    var GL_ALPHA = 0x1906;
    var GL_RGB = 0x1907;
    var GL_LUMINANCE = 0x1909;
    var GL_LUMINANCE_ALPHA = 0x190A;

    var GL_RGBA4 = 0x8056;
    var GL_RGB5_A1 = 0x8057;
    var GL_RGB565 = 0x8D62;

    var GL_UNSIGNED_SHORT_4_4_4_4$1 = 0x8033;
    var GL_UNSIGNED_SHORT_5_5_5_1$1 = 0x8034;
    var GL_UNSIGNED_SHORT_5_6_5$1 = 0x8363;
    var GL_UNSIGNED_INT_24_8_WEBGL$1 = 0x84FA;

    var GL_DEPTH_COMPONENT = 0x1902;
    var GL_DEPTH_STENCIL = 0x84F9;

    var GL_SRGB_EXT = 0x8C40;
    var GL_SRGB_ALPHA_EXT = 0x8C42;

    var GL_HALF_FLOAT_OES$1 = 0x8D61;

    var GL_COMPRESSED_RGB_S3TC_DXT1_EXT = 0x83F0;
    var GL_COMPRESSED_RGBA_S3TC_DXT1_EXT = 0x83F1;
    var GL_COMPRESSED_RGBA_S3TC_DXT3_EXT = 0x83F2;
    var GL_COMPRESSED_RGBA_S3TC_DXT5_EXT = 0x83F3;

    var GL_COMPRESSED_RGB_ATC_WEBGL = 0x8C92;
    var GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL = 0x8C93;
    var GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL = 0x87EE;

    var GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG = 0x8C00;
    var GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG = 0x8C01;
    var GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG = 0x8C02;
    var GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG = 0x8C03;

    var GL_COMPRESSED_RGB_ETC1_WEBGL = 0x8D64;

    var GL_UNSIGNED_BYTE$5 = 0x1401;
    var GL_UNSIGNED_SHORT$3 = 0x1403;
    var GL_UNSIGNED_INT$3 = 0x1405;
    var GL_FLOAT$4 = 0x1406;

    var GL_TEXTURE_WRAP_S = 0x2802;
    var GL_TEXTURE_WRAP_T = 0x2803;

    var GL_REPEAT = 0x2901;
    var GL_CLAMP_TO_EDGE$1 = 0x812F;
    var GL_MIRRORED_REPEAT = 0x8370;

    var GL_TEXTURE_MAG_FILTER = 0x2800;
    var GL_TEXTURE_MIN_FILTER = 0x2801;

    var GL_NEAREST$1 = 0x2600;
    var GL_LINEAR = 0x2601;
    var GL_NEAREST_MIPMAP_NEAREST$1 = 0x2700;
    var GL_LINEAR_MIPMAP_NEAREST$1 = 0x2701;
    var GL_NEAREST_MIPMAP_LINEAR$1 = 0x2702;
    var GL_LINEAR_MIPMAP_LINEAR$1 = 0x2703;

    var GL_GENERATE_MIPMAP_HINT = 0x8192;
    var GL_DONT_CARE = 0x1100;
    var GL_FASTEST = 0x1101;
    var GL_NICEST = 0x1102;

    var GL_TEXTURE_MAX_ANISOTROPY_EXT = 0x84FE;

    var GL_UNPACK_ALIGNMENT = 0x0CF5;
    var GL_UNPACK_FLIP_Y_WEBGL = 0x9240;
    var GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241;
    var GL_UNPACK_COLORSPACE_CONVERSION_WEBGL = 0x9243;

    var GL_BROWSER_DEFAULT_WEBGL = 0x9244;

    var GL_TEXTURE0$1 = 0x84C0;

    var MIPMAP_FILTERS = [
      GL_NEAREST_MIPMAP_NEAREST$1,
      GL_NEAREST_MIPMAP_LINEAR$1,
      GL_LINEAR_MIPMAP_NEAREST$1,
      GL_LINEAR_MIPMAP_LINEAR$1
    ];

    var CHANNELS_FORMAT = [
      0,
      GL_LUMINANCE,
      GL_LUMINANCE_ALPHA,
      GL_RGB,
      GL_RGBA$1
    ];

    var FORMAT_CHANNELS = {};
    FORMAT_CHANNELS[GL_LUMINANCE] =
    FORMAT_CHANNELS[GL_ALPHA] =
    FORMAT_CHANNELS[GL_DEPTH_COMPONENT] = 1;
    FORMAT_CHANNELS[GL_DEPTH_STENCIL] =
    FORMAT_CHANNELS[GL_LUMINANCE_ALPHA] = 2;
    FORMAT_CHANNELS[GL_RGB] =
    FORMAT_CHANNELS[GL_SRGB_EXT] = 3;
    FORMAT_CHANNELS[GL_RGBA$1] =
    FORMAT_CHANNELS[GL_SRGB_ALPHA_EXT] = 4;

    function objectName (str) {
      return '[object ' + str + ']'
    }

    var CANVAS_CLASS = objectName('HTMLCanvasElement');
    var OFFSCREENCANVAS_CLASS = objectName('OffscreenCanvas');
    var CONTEXT2D_CLASS = objectName('CanvasRenderingContext2D');
    var BITMAP_CLASS = objectName('ImageBitmap');
    var IMAGE_CLASS = objectName('HTMLImageElement');
    var VIDEO_CLASS = objectName('HTMLVideoElement');

    var PIXEL_CLASSES = Object.keys(arrayTypes).concat([
      CANVAS_CLASS,
      OFFSCREENCANVAS_CLASS,
      CONTEXT2D_CLASS,
      BITMAP_CLASS,
      IMAGE_CLASS,
      VIDEO_CLASS
    ]);

    // for every texture type, store
    // the size in bytes.
    var TYPE_SIZES = [];
    TYPE_SIZES[GL_UNSIGNED_BYTE$5] = 1;
    TYPE_SIZES[GL_FLOAT$4] = 4;
    TYPE_SIZES[GL_HALF_FLOAT_OES$1] = 2;

    TYPE_SIZES[GL_UNSIGNED_SHORT$3] = 2;
    TYPE_SIZES[GL_UNSIGNED_INT$3] = 4;

    var FORMAT_SIZES_SPECIAL = [];
    FORMAT_SIZES_SPECIAL[GL_RGBA4] = 2;
    FORMAT_SIZES_SPECIAL[GL_RGB5_A1] = 2;
    FORMAT_SIZES_SPECIAL[GL_RGB565] = 2;
    FORMAT_SIZES_SPECIAL[GL_DEPTH_STENCIL] = 4;

    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_S3TC_DXT1_EXT] = 0.5;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT1_EXT] = 0.5;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT3_EXT] = 1;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_S3TC_DXT5_EXT] = 1;

    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ATC_WEBGL] = 0.5;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL] = 1;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL] = 1;

    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG] = 0.5;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG] = 0.25;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG] = 0.5;
    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG] = 0.25;

    FORMAT_SIZES_SPECIAL[GL_COMPRESSED_RGB_ETC1_WEBGL] = 0.5;

    function isNumericArray (arr) {
      return (
        Array.isArray(arr) &&
        (arr.length === 0 ||
        typeof arr[0] === 'number'))
    }

    function isRectArray (arr) {
      if (!Array.isArray(arr)) {
        return false
      }
      var width = arr.length;
      if (width === 0 || !isArrayLike(arr[0])) {
        return false
      }
      return true
    }

    function classString (x) {
      return Object.prototype.toString.call(x)
    }

    function isCanvasElement (object) {
      return classString(object) === CANVAS_CLASS
    }

    function isOffscreenCanvas (object) {
      return classString(object) === OFFSCREENCANVAS_CLASS
    }

    function isContext2D (object) {
      return classString(object) === CONTEXT2D_CLASS
    }

    function isBitmap (object) {
      return classString(object) === BITMAP_CLASS
    }

    function isImageElement (object) {
      return classString(object) === IMAGE_CLASS
    }

    function isVideoElement (object) {
      return classString(object) === VIDEO_CLASS
    }

    function isPixelData (object) {
      if (!object) {
        return false
      }
      var className = classString(object);
      if (PIXEL_CLASSES.indexOf(className) >= 0) {
        return true
      }
      return (
        isNumericArray(object) ||
        isRectArray(object) ||
        isNDArrayLike(object))
    }

    function typedArrayCode$1 (data) {
      return arrayTypes[Object.prototype.toString.call(data)] | 0
    }

    function convertData (result, data) {
      var n = data.length;
      switch (result.type) {
        case GL_UNSIGNED_BYTE$5:
        case GL_UNSIGNED_SHORT$3:
        case GL_UNSIGNED_INT$3:
        case GL_FLOAT$4:
          var converted = pool.allocType(result.type, n);
          converted.set(data);
          result.data = converted;
          break

        case GL_HALF_FLOAT_OES$1:
          result.data = convertToHalfFloat(data);
          break

        default:
          check$1.raise('unsupported texture type, must specify a typed array');
      }
    }

    function preConvert (image, n) {
      return pool.allocType(
        image.type === GL_HALF_FLOAT_OES$1
          ? GL_FLOAT$4
          : image.type, n)
    }

    function postConvert (image, data) {
      if (image.type === GL_HALF_FLOAT_OES$1) {
        image.data = convertToHalfFloat(data);
        pool.freeType(data);
      } else {
        image.data = data;
      }
    }

    function transposeData (image, array, strideX, strideY, strideC, offset) {
      var w = image.width;
      var h = image.height;
      var c = image.channels;
      var n = w * h * c;
      var data = preConvert(image, n);

      var p = 0;
      for (var i = 0; i < h; ++i) {
        for (var j = 0; j < w; ++j) {
          for (var k = 0; k < c; ++k) {
            data[p++] = array[strideX * j + strideY * i + strideC * k + offset];
          }
        }
      }

      postConvert(image, data);
    }

    function getTextureSize (format, type, width, height, isMipmap, isCube) {
      var s;
      if (typeof FORMAT_SIZES_SPECIAL[format] !== 'undefined') {
        // we have a special array for dealing with weird color formats such as RGB5A1
        s = FORMAT_SIZES_SPECIAL[format];
      } else {
        s = FORMAT_CHANNELS[format] * TYPE_SIZES[type];
      }

      if (isCube) {
        s *= 6;
      }

      if (isMipmap) {
        // compute the total size of all the mipmaps.
        var total = 0;

        var w = width;
        while (w >= 1) {
          // we can only use mipmaps on a square image,
          // so we can simply use the width and ignore the height:
          total += s * w * w;
          w /= 2;
        }
        return total
      } else {
        return s * width * height
      }
    }

    function createTextureSet (
      gl, extensions, limits, reglPoll, contextState, stats, config) {
      // -------------------------------------------------------
      // Initialize constants and parameter tables here
      // -------------------------------------------------------
      var mipmapHint = {
        "don't care": GL_DONT_CARE,
        'dont care': GL_DONT_CARE,
        'nice': GL_NICEST,
        'fast': GL_FASTEST
      };

      var wrapModes = {
        'repeat': GL_REPEAT,
        'clamp': GL_CLAMP_TO_EDGE$1,
        'mirror': GL_MIRRORED_REPEAT
      };

      var magFilters = {
        'nearest': GL_NEAREST$1,
        'linear': GL_LINEAR
      };

      var minFilters = extend({
        'mipmap': GL_LINEAR_MIPMAP_LINEAR$1,
        'nearest mipmap nearest': GL_NEAREST_MIPMAP_NEAREST$1,
        'linear mipmap nearest': GL_LINEAR_MIPMAP_NEAREST$1,
        'nearest mipmap linear': GL_NEAREST_MIPMAP_LINEAR$1,
        'linear mipmap linear': GL_LINEAR_MIPMAP_LINEAR$1
      }, magFilters);

      var colorSpace = {
        'none': 0,
        'browser': GL_BROWSER_DEFAULT_WEBGL
      };

      var textureTypes = {
        'uint8': GL_UNSIGNED_BYTE$5,
        'rgba4': GL_UNSIGNED_SHORT_4_4_4_4$1,
        'rgb565': GL_UNSIGNED_SHORT_5_6_5$1,
        'rgb5 a1': GL_UNSIGNED_SHORT_5_5_5_1$1
      };

      var textureFormats = {
        'alpha': GL_ALPHA,
        'luminance': GL_LUMINANCE,
        'luminance alpha': GL_LUMINANCE_ALPHA,
        'rgb': GL_RGB,
        'rgba': GL_RGBA$1,
        'rgba4': GL_RGBA4,
        'rgb5 a1': GL_RGB5_A1,
        'rgb565': GL_RGB565
      };

      var compressedTextureFormats = {};

      if (extensions.ext_srgb) {
        textureFormats.srgb = GL_SRGB_EXT;
        textureFormats.srgba = GL_SRGB_ALPHA_EXT;
      }

      if (extensions.oes_texture_float) {
        textureTypes.float32 = textureTypes.float = GL_FLOAT$4;
      }

      if (extensions.oes_texture_half_float) {
        textureTypes['float16'] = textureTypes['half float'] = GL_HALF_FLOAT_OES$1;
      }

      if (extensions.webgl_depth_texture) {
        extend(textureFormats, {
          'depth': GL_DEPTH_COMPONENT,
          'depth stencil': GL_DEPTH_STENCIL
        });

        extend(textureTypes, {
          'uint16': GL_UNSIGNED_SHORT$3,
          'uint32': GL_UNSIGNED_INT$3,
          'depth stencil': GL_UNSIGNED_INT_24_8_WEBGL$1
        });
      }

      if (extensions.webgl_compressed_texture_s3tc) {
        extend(compressedTextureFormats, {
          'rgb s3tc dxt1': GL_COMPRESSED_RGB_S3TC_DXT1_EXT,
          'rgba s3tc dxt1': GL_COMPRESSED_RGBA_S3TC_DXT1_EXT,
          'rgba s3tc dxt3': GL_COMPRESSED_RGBA_S3TC_DXT3_EXT,
          'rgba s3tc dxt5': GL_COMPRESSED_RGBA_S3TC_DXT5_EXT
        });
      }

      if (extensions.webgl_compressed_texture_atc) {
        extend(compressedTextureFormats, {
          'rgb atc': GL_COMPRESSED_RGB_ATC_WEBGL,
          'rgba atc explicit alpha': GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL,
          'rgba atc interpolated alpha': GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL
        });
      }

      if (extensions.webgl_compressed_texture_pvrtc) {
        extend(compressedTextureFormats, {
          'rgb pvrtc 4bppv1': GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
          'rgb pvrtc 2bppv1': GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG,
          'rgba pvrtc 4bppv1': GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
          'rgba pvrtc 2bppv1': GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG
        });
      }

      if (extensions.webgl_compressed_texture_etc1) {
        compressedTextureFormats['rgb etc1'] = GL_COMPRESSED_RGB_ETC1_WEBGL;
      }

      // Copy over all texture formats
      var supportedCompressedFormats = Array.prototype.slice.call(
        gl.getParameter(GL_COMPRESSED_TEXTURE_FORMATS));
      Object.keys(compressedTextureFormats).forEach(function (name) {
        var format = compressedTextureFormats[name];
        if (supportedCompressedFormats.indexOf(format) >= 0) {
          textureFormats[name] = format;
        }
      });

      var supportedFormats = Object.keys(textureFormats);
      limits.textureFormats = supportedFormats;

      // associate with every format string its
      // corresponding GL-value.
      var textureFormatsInvert = [];
      Object.keys(textureFormats).forEach(function (key) {
        var val = textureFormats[key];
        textureFormatsInvert[val] = key;
      });

      // associate with every type string its
      // corresponding GL-value.
      var textureTypesInvert = [];
      Object.keys(textureTypes).forEach(function (key) {
        var val = textureTypes[key];
        textureTypesInvert[val] = key;
      });

      var magFiltersInvert = [];
      Object.keys(magFilters).forEach(function (key) {
        var val = magFilters[key];
        magFiltersInvert[val] = key;
      });

      var minFiltersInvert = [];
      Object.keys(minFilters).forEach(function (key) {
        var val = minFilters[key];
        minFiltersInvert[val] = key;
      });

      var wrapModesInvert = [];
      Object.keys(wrapModes).forEach(function (key) {
        var val = wrapModes[key];
        wrapModesInvert[val] = key;
      });

      // colorFormats[] gives the format (channels) associated to an
      // internalformat
      var colorFormats = supportedFormats.reduce(function (color, key) {
        var glenum = textureFormats[key];
        if (glenum === GL_LUMINANCE ||
            glenum === GL_ALPHA ||
            glenum === GL_LUMINANCE ||
            glenum === GL_LUMINANCE_ALPHA ||
            glenum === GL_DEPTH_COMPONENT ||
            glenum === GL_DEPTH_STENCIL ||
            (extensions.ext_srgb &&
                    (glenum === GL_SRGB_EXT ||
                     glenum === GL_SRGB_ALPHA_EXT))) {
          color[glenum] = glenum;
        } else if (glenum === GL_RGB5_A1 || key.indexOf('rgba') >= 0) {
          color[glenum] = GL_RGBA$1;
        } else {
          color[glenum] = GL_RGB;
        }
        return color
      }, {});

      function TexFlags () {
        // format info
        this.internalformat = GL_RGBA$1;
        this.format = GL_RGBA$1;
        this.type = GL_UNSIGNED_BYTE$5;
        this.compressed = false;

        // pixel storage
        this.premultiplyAlpha = false;
        this.flipY = false;
        this.unpackAlignment = 1;
        this.colorSpace = GL_BROWSER_DEFAULT_WEBGL;

        // shape info
        this.width = 0;
        this.height = 0;
        this.channels = 0;
      }

      function copyFlags (result, other) {
        result.internalformat = other.internalformat;
        result.format = other.format;
        result.type = other.type;
        result.compressed = other.compressed;

        result.premultiplyAlpha = other.premultiplyAlpha;
        result.flipY = other.flipY;
        result.unpackAlignment = other.unpackAlignment;
        result.colorSpace = other.colorSpace;

        result.width = other.width;
        result.height = other.height;
        result.channels = other.channels;
      }

      function parseFlags (flags, options) {
        if (typeof options !== 'object' || !options) {
          return
        }

        if ('premultiplyAlpha' in options) {
          check$1.type(options.premultiplyAlpha, 'boolean',
            'invalid premultiplyAlpha');
          flags.premultiplyAlpha = options.premultiplyAlpha;
        }

        if ('flipY' in options) {
          check$1.type(options.flipY, 'boolean',
            'invalid texture flip');
          flags.flipY = options.flipY;
        }

        if ('alignment' in options) {
          check$1.oneOf(options.alignment, [1, 2, 4, 8],
            'invalid texture unpack alignment');
          flags.unpackAlignment = options.alignment;
        }

        if ('colorSpace' in options) {
          check$1.parameter(options.colorSpace, colorSpace,
            'invalid colorSpace');
          flags.colorSpace = colorSpace[options.colorSpace];
        }

        if ('type' in options) {
          var type = options.type;
          check$1(extensions.oes_texture_float ||
            !(type === 'float' || type === 'float32'),
          'you must enable the OES_texture_float extension in order to use floating point textures.');
          check$1(extensions.oes_texture_half_float ||
            !(type === 'half float' || type === 'float16'),
          'you must enable the OES_texture_half_float extension in order to use 16-bit floating point textures.');
          check$1(extensions.webgl_depth_texture ||
            !(type === 'uint16' || type === 'uint32' || type === 'depth stencil'),
          'you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures.');
          check$1.parameter(type, textureTypes,
            'invalid texture type');
          flags.type = textureTypes[type];
        }

        var w = flags.width;
        var h = flags.height;
        var c = flags.channels;
        var hasChannels = false;
        if ('shape' in options) {
          check$1(Array.isArray(options.shape) && options.shape.length >= 2,
            'shape must be an array');
          w = options.shape[0];
          h = options.shape[1];
          if (options.shape.length === 3) {
            c = options.shape[2];
            check$1(c > 0 && c <= 4, 'invalid number of channels');
            hasChannels = true;
          }
          check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid width');
          check$1(h >= 0 && h <= limits.maxTextureSize, 'invalid height');
        } else {
          if ('radius' in options) {
            w = h = options.radius;
            check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid radius');
          }
          if ('width' in options) {
            w = options.width;
            check$1(w >= 0 && w <= limits.maxTextureSize, 'invalid width');
          }
          if ('height' in options) {
            h = options.height;
            check$1(h >= 0 && h <= limits.maxTextureSize, 'invalid height');
          }
          if ('channels' in options) {
            c = options.channels;
            check$1(c > 0 && c <= 4, 'invalid number of channels');
            hasChannels = true;
          }
        }
        flags.width = w | 0;
        flags.height = h | 0;
        flags.channels = c | 0;

        var hasFormat = false;
        if ('format' in options) {
          var formatStr = options.format;
          check$1(extensions.webgl_depth_texture ||
            !(formatStr === 'depth' || formatStr === 'depth stencil'),
          'you must enable the WEBGL_depth_texture extension in order to use depth/stencil textures.');
          check$1.parameter(formatStr, textureFormats,
            'invalid texture format');
          var internalformat = flags.internalformat = textureFormats[formatStr];
          flags.format = colorFormats[internalformat];
          if (formatStr in textureTypes) {
            if (!('type' in options)) {
              flags.type = textureTypes[formatStr];
            }
          }
          if (formatStr in compressedTextureFormats) {
            flags.compressed = true;
          }
          hasFormat = true;
        }

        // Reconcile channels and format
        if (!hasChannels && hasFormat) {
          flags.channels = FORMAT_CHANNELS[flags.format];
        } else if (hasChannels && !hasFormat) {
          if (flags.channels !== CHANNELS_FORMAT[flags.format]) {
            flags.format = flags.internalformat = CHANNELS_FORMAT[flags.channels];
          }
        } else if (hasFormat && hasChannels) {
          check$1(
            flags.channels === FORMAT_CHANNELS[flags.format],
            'number of channels inconsistent with specified format');
        }
      }

      function setFlags (flags) {
        gl.pixelStorei(GL_UNPACK_FLIP_Y_WEBGL, flags.flipY);
        gl.pixelStorei(GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL, flags.premultiplyAlpha);
        gl.pixelStorei(GL_UNPACK_COLORSPACE_CONVERSION_WEBGL, flags.colorSpace);
        gl.pixelStorei(GL_UNPACK_ALIGNMENT, flags.unpackAlignment);
      }

      // -------------------------------------------------------
      // Tex image data
      // -------------------------------------------------------
      function TexImage () {
        TexFlags.call(this);

        this.xOffset = 0;
        this.yOffset = 0;

        // data
        this.data = null;
        this.needsFree = false;

        // html element
        this.element = null;

        // copyTexImage info
        this.needsCopy = false;
      }

      function parseImage (image, options) {
        var data = null;
        if (isPixelData(options)) {
          data = options;
        } else if (options) {
          check$1.type(options, 'object', 'invalid pixel data type');
          parseFlags(image, options);
          if ('x' in options) {
            image.xOffset = options.x | 0;
          }
          if ('y' in options) {
            image.yOffset = options.y | 0;
          }
          if (isPixelData(options.data)) {
            data = options.data;
          }
        }

        check$1(
          !image.compressed ||
          data instanceof Uint8Array,
          'compressed texture data must be stored in a uint8array');

        if (options.copy) {
          check$1(!data, 'can not specify copy and data field for the same texture');
          var viewW = contextState.viewportWidth;
          var viewH = contextState.viewportHeight;
          image.width = image.width || (viewW - image.xOffset);
          image.height = image.height || (viewH - image.yOffset);
          image.needsCopy = true;
          check$1(image.xOffset >= 0 && image.xOffset < viewW &&
                image.yOffset >= 0 && image.yOffset < viewH &&
                image.width > 0 && image.width <= viewW &&
                image.height > 0 && image.height <= viewH,
          'copy texture read out of bounds');
        } else if (!data) {
          image.width = image.width || 1;
          image.height = image.height || 1;
          image.channels = image.channels || 4;
        } else if (isTypedArray(data)) {
          image.channels = image.channels || 4;
          image.data = data;
          if (!('type' in options) && image.type === GL_UNSIGNED_BYTE$5) {
            image.type = typedArrayCode$1(data);
          }
        } else if (isNumericArray(data)) {
          image.channels = image.channels || 4;
          convertData(image, data);
          image.alignment = 1;
          image.needsFree = true;
        } else if (isNDArrayLike(data)) {
          var array = data.data;
          if (!Array.isArray(array) && image.type === GL_UNSIGNED_BYTE$5) {
            image.type = typedArrayCode$1(array);
          }
          var shape = data.shape;
          var stride = data.stride;
          var shapeX, shapeY, shapeC, strideX, strideY, strideC;
          if (shape.length === 3) {
            shapeC = shape[2];
            strideC = stride[2];
          } else {
            check$1(shape.length === 2, 'invalid ndarray pixel data, must be 2 or 3D');
            shapeC = 1;
            strideC = 1;
          }
          shapeX = shape[0];
          shapeY = shape[1];
          strideX = stride[0];
          strideY = stride[1];
          image.alignment = 1;
          image.width = shapeX;
          image.height = shapeY;
          image.channels = shapeC;
          image.format = image.internalformat = CHANNELS_FORMAT[shapeC];
          image.needsFree = true;
          transposeData(image, array, strideX, strideY, strideC, data.offset);
        } else if (isCanvasElement(data) || isOffscreenCanvas(data) || isContext2D(data)) {
          if (isCanvasElement(data) || isOffscreenCanvas(data)) {
            image.element = data;
          } else {
            image.element = data.canvas;
          }
          image.width = image.element.width;
          image.height = image.element.height;
          image.channels = 4;
        } else if (isBitmap(data)) {
          image.element = data;
          image.width = data.width;
          image.height = data.height;
          image.channels = 4;
        } else if (isImageElement(data)) {
          image.element = data;
          image.width = data.naturalWidth;
          image.height = data.naturalHeight;
          image.channels = 4;
        } else if (isVideoElement(data)) {
          image.element = data;
          image.width = data.videoWidth;
          image.height = data.videoHeight;
          image.channels = 4;
        } else if (isRectArray(data)) {
          var w = image.width || data[0].length;
          var h = image.height || data.length;
          var c = image.channels;
          if (isArrayLike(data[0][0])) {
            c = c || data[0][0].length;
          } else {
            c = c || 1;
          }
          var arrayShape = flattenUtils.shape(data);
          var n = 1;
          for (var dd = 0; dd < arrayShape.length; ++dd) {
            n *= arrayShape[dd];
          }
          var allocData = preConvert(image, n);
          flattenUtils.flatten(data, arrayShape, '', allocData);
          postConvert(image, allocData);
          image.alignment = 1;
          image.width = w;
          image.height = h;
          image.channels = c;
          image.format = image.internalformat = CHANNELS_FORMAT[c];
          image.needsFree = true;
        }

        if (image.type === GL_FLOAT$4) {
          check$1(limits.extensions.indexOf('oes_texture_float') >= 0,
            'oes_texture_float extension not enabled');
        } else if (image.type === GL_HALF_FLOAT_OES$1) {
          check$1(limits.extensions.indexOf('oes_texture_half_float') >= 0,
            'oes_texture_half_float extension not enabled');
        }

        // do compressed texture  validation here.
      }

      function setImage (info, target, miplevel) {
        var element = info.element;
        var data = info.data;
        var internalformat = info.internalformat;
        var format = info.format;
        var type = info.type;
        var width = info.width;
        var height = info.height;

        setFlags(info);

        if (element) {
          gl.texImage2D(target, miplevel, format, format, type, element);
        } else if (info.compressed) {
          gl.compressedTexImage2D(target, miplevel, internalformat, width, height, 0, data);
        } else if (info.needsCopy) {
          reglPoll();
          gl.copyTexImage2D(
            target, miplevel, format, info.xOffset, info.yOffset, width, height, 0);
        } else {
          gl.texImage2D(target, miplevel, format, width, height, 0, format, type, data || null);
        }
      }

      function setSubImage (info, target, x, y, miplevel) {
        var element = info.element;
        var data = info.data;
        var internalformat = info.internalformat;
        var format = info.format;
        var type = info.type;
        var width = info.width;
        var height = info.height;

        setFlags(info);

        if (element) {
          gl.texSubImage2D(
            target, miplevel, x, y, format, type, element);
        } else if (info.compressed) {
          gl.compressedTexSubImage2D(
            target, miplevel, x, y, internalformat, width, height, data);
        } else if (info.needsCopy) {
          reglPoll();
          gl.copyTexSubImage2D(
            target, miplevel, x, y, info.xOffset, info.yOffset, width, height);
        } else {
          gl.texSubImage2D(
            target, miplevel, x, y, width, height, format, type, data);
        }
      }

      // texImage pool
      var imagePool = [];

      function allocImage () {
        return imagePool.pop() || new TexImage()
      }

      function freeImage (image) {
        if (image.needsFree) {
          pool.freeType(image.data);
        }
        TexImage.call(image);
        imagePool.push(image);
      }

      // -------------------------------------------------------
      // Mip map
      // -------------------------------------------------------
      function MipMap () {
        TexFlags.call(this);

        this.genMipmaps = false;
        this.mipmapHint = GL_DONT_CARE;
        this.mipmask = 0;
        this.images = Array(16);
      }

      function parseMipMapFromShape (mipmap, width, height) {
        var img = mipmap.images[0] = allocImage();
        mipmap.mipmask = 1;
        img.width = mipmap.width = width;
        img.height = mipmap.height = height;
        img.channels = mipmap.channels = 4;
      }

      function parseMipMapFromObject (mipmap, options) {
        var imgData = null;
        if (isPixelData(options)) {
          imgData = mipmap.images[0] = allocImage();
          copyFlags(imgData, mipmap);
          parseImage(imgData, options);
          mipmap.mipmask = 1;
        } else {
          parseFlags(mipmap, options);
          if (Array.isArray(options.mipmap)) {
            var mipData = options.mipmap;
            for (var i = 0; i < mipData.length; ++i) {
              imgData = mipmap.images[i] = allocImage();
              copyFlags(imgData, mipmap);
              imgData.width >>= i;
              imgData.height >>= i;
              parseImage(imgData, mipData[i]);
              mipmap.mipmask |= (1 << i);
            }
          } else {
            imgData = mipmap.images[0] = allocImage();
            copyFlags(imgData, mipmap);
            parseImage(imgData, options);
            mipmap.mipmask = 1;
          }
        }
        copyFlags(mipmap, mipmap.images[0]);

        // For textures of the compressed format WEBGL_compressed_texture_s3tc
        // we must have that
        //
        // "When level equals zero width and height must be a multiple of 4.
        // When level is greater than 0 width and height must be 0, 1, 2 or a multiple of 4. "
        //
        // but we do not yet support having multiple mipmap levels for compressed textures,
        // so we only test for level zero.

        if (
          mipmap.compressed &&
          (
            mipmap.internalformat === GL_COMPRESSED_RGB_S3TC_DXT1_EXT ||
            mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT1_EXT ||
            mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT3_EXT ||
            mipmap.internalformat === GL_COMPRESSED_RGBA_S3TC_DXT5_EXT
          )
        ) {
          check$1(mipmap.width % 4 === 0 && mipmap.height % 4 === 0,
            'for compressed texture formats, mipmap level 0 must have width and height that are a multiple of 4');
        }
      }

      function setMipMap (mipmap, target) {
        var images = mipmap.images;
        for (var i = 0; i < images.length; ++i) {
          if (!images[i]) {
            return
          }
          setImage(images[i], target, i);
        }
      }

      var mipPool = [];

      function allocMipMap () {
        var result = mipPool.pop() || new MipMap();
        TexFlags.call(result);
        result.mipmask = 0;
        for (var i = 0; i < 16; ++i) {
          result.images[i] = null;
        }
        return result
      }

      function freeMipMap (mipmap) {
        var images = mipmap.images;
        for (var i = 0; i < images.length; ++i) {
          if (images[i]) {
            freeImage(images[i]);
          }
          images[i] = null;
        }
        mipPool.push(mipmap);
      }

      // -------------------------------------------------------
      // Tex info
      // -------------------------------------------------------
      function TexInfo () {
        this.minFilter = GL_NEAREST$1;
        this.magFilter = GL_NEAREST$1;

        this.wrapS = GL_CLAMP_TO_EDGE$1;
        this.wrapT = GL_CLAMP_TO_EDGE$1;

        this.anisotropic = 1;

        this.genMipmaps = false;
        this.mipmapHint = GL_DONT_CARE;
      }

      function parseTexInfo (info, options) {
        if ('min' in options) {
          var minFilter = options.min;
          check$1.parameter(minFilter, minFilters);
          info.minFilter = minFilters[minFilter];
          if (MIPMAP_FILTERS.indexOf(info.minFilter) >= 0 && !('faces' in options)) {
            info.genMipmaps = true;
          }
        }

        if ('mag' in options) {
          var magFilter = options.mag;
          check$1.parameter(magFilter, magFilters);
          info.magFilter = magFilters[magFilter];
        }

        var wrapS = info.wrapS;
        var wrapT = info.wrapT;
        if ('wrap' in options) {
          var wrap = options.wrap;
          if (typeof wrap === 'string') {
            check$1.parameter(wrap, wrapModes);
            wrapS = wrapT = wrapModes[wrap];
          } else if (Array.isArray(wrap)) {
            check$1.parameter(wrap[0], wrapModes);
            check$1.parameter(wrap[1], wrapModes);
            wrapS = wrapModes[wrap[0]];
            wrapT = wrapModes[wrap[1]];
          }
        } else {
          if ('wrapS' in options) {
            var optWrapS = options.wrapS;
            check$1.parameter(optWrapS, wrapModes);
            wrapS = wrapModes[optWrapS];
          }
          if ('wrapT' in options) {
            var optWrapT = options.wrapT;
            check$1.parameter(optWrapT, wrapModes);
            wrapT = wrapModes[optWrapT];
          }
        }
        info.wrapS = wrapS;
        info.wrapT = wrapT;

        if ('anisotropic' in options) {
          var anisotropic = options.anisotropic;
          check$1(typeof anisotropic === 'number' &&
             anisotropic >= 1 && anisotropic <= limits.maxAnisotropic,
          'aniso samples must be between 1 and ');
          info.anisotropic = options.anisotropic;
        }

        if ('mipmap' in options) {
          var hasMipMap = false;
          switch (typeof options.mipmap) {
            case 'string':
              check$1.parameter(options.mipmap, mipmapHint,
                'invalid mipmap hint');
              info.mipmapHint = mipmapHint[options.mipmap];
              info.genMipmaps = true;
              hasMipMap = true;
              break

            case 'boolean':
              hasMipMap = info.genMipmaps = options.mipmap;
              break

            case 'object':
              check$1(Array.isArray(options.mipmap), 'invalid mipmap type');
              info.genMipmaps = false;
              hasMipMap = true;
              break

            default:
              check$1.raise('invalid mipmap type');
          }
          if (hasMipMap && !('min' in options)) {
            info.minFilter = GL_NEAREST_MIPMAP_NEAREST$1;
          }
        }
      }

      function setTexInfo (info, target) {
        gl.texParameteri(target, GL_TEXTURE_MIN_FILTER, info.minFilter);
        gl.texParameteri(target, GL_TEXTURE_MAG_FILTER, info.magFilter);
        gl.texParameteri(target, GL_TEXTURE_WRAP_S, info.wrapS);
        gl.texParameteri(target, GL_TEXTURE_WRAP_T, info.wrapT);
        if (extensions.ext_texture_filter_anisotropic) {
          gl.texParameteri(target, GL_TEXTURE_MAX_ANISOTROPY_EXT, info.anisotropic);
        }
        if (info.genMipmaps) {
          gl.hint(GL_GENERATE_MIPMAP_HINT, info.mipmapHint);
          gl.generateMipmap(target);
        }
      }

      // -------------------------------------------------------
      // Full texture object
      // -------------------------------------------------------
      var textureCount = 0;
      var textureSet = {};
      var numTexUnits = limits.maxTextureUnits;
      var textureUnits = Array(numTexUnits).map(function () {
        return null
      });

      function REGLTexture (target) {
        TexFlags.call(this);
        this.mipmask = 0;
        this.internalformat = GL_RGBA$1;

        this.id = textureCount++;

        this.refCount = 1;

        this.target = target;
        this.texture = gl.createTexture();

        this.unit = -1;
        this.bindCount = 0;

        this.texInfo = new TexInfo();

        if (config.profile) {
          this.stats = { size: 0 };
        }
      }

      function tempBind (texture) {
        gl.activeTexture(GL_TEXTURE0$1);
        gl.bindTexture(texture.target, texture.texture);
      }

      function tempRestore () {
        var prev = textureUnits[0];
        if (prev) {
          gl.bindTexture(prev.target, prev.texture);
        } else {
          gl.bindTexture(GL_TEXTURE_2D$1, null);
        }
      }

      function destroy (texture) {
        var handle = texture.texture;
        check$1(handle, 'must not double destroy texture');
        var unit = texture.unit;
        var target = texture.target;
        if (unit >= 0) {
          gl.activeTexture(GL_TEXTURE0$1 + unit);
          gl.bindTexture(target, null);
          textureUnits[unit] = null;
        }
        gl.deleteTexture(handle);
        texture.texture = null;
        texture.params = null;
        texture.pixels = null;
        texture.refCount = 0;
        delete textureSet[texture.id];
        stats.textureCount--;
      }

      extend(REGLTexture.prototype, {
        bind: function () {
          var texture = this;
          texture.bindCount += 1;
          var unit = texture.unit;
          if (unit < 0) {
            for (var i = 0; i < numTexUnits; ++i) {
              var other = textureUnits[i];
              if (other) {
                if (other.bindCount > 0) {
                  continue
                }
                other.unit = -1;
              }
              textureUnits[i] = texture;
              unit = i;
              break
            }
            if (unit >= numTexUnits) {
              check$1.raise('insufficient number of texture units');
            }
            if (config.profile && stats.maxTextureUnits < (unit + 1)) {
              stats.maxTextureUnits = unit + 1; // +1, since the units are zero-based
            }
            texture.unit = unit;
            gl.activeTexture(GL_TEXTURE0$1 + unit);
            gl.bindTexture(texture.target, texture.texture);
          }
          return unit
        },

        unbind: function () {
          this.bindCount -= 1;
        },

        decRef: function () {
          if (--this.refCount <= 0) {
            destroy(this);
          }
        }
      });

      function createTexture2D (a, b) {
        var texture = new REGLTexture(GL_TEXTURE_2D$1);
        textureSet[texture.id] = texture;
        stats.textureCount++;

        function reglTexture2D (a, b) {
          var texInfo = texture.texInfo;
          TexInfo.call(texInfo);
          var mipData = allocMipMap();

          if (typeof a === 'number') {
            if (typeof b === 'number') {
              parseMipMapFromShape(mipData, a | 0, b | 0);
            } else {
              parseMipMapFromShape(mipData, a | 0, a | 0);
            }
          } else if (a) {
            check$1.type(a, 'object', 'invalid arguments to regl.texture');
            parseTexInfo(texInfo, a);
            parseMipMapFromObject(mipData, a);
          } else {
            // empty textures get assigned a default shape of 1x1
            parseMipMapFromShape(mipData, 1, 1);
          }

          if (texInfo.genMipmaps) {
            mipData.mipmask = (mipData.width << 1) - 1;
          }
          texture.mipmask = mipData.mipmask;

          copyFlags(texture, mipData);

          check$1.texture2D(texInfo, mipData, limits);
          texture.internalformat = mipData.internalformat;

          reglTexture2D.width = mipData.width;
          reglTexture2D.height = mipData.height;

          tempBind(texture);
          setMipMap(mipData, GL_TEXTURE_2D$1);
          setTexInfo(texInfo, GL_TEXTURE_2D$1);
          tempRestore();

          freeMipMap(mipData);

          if (config.profile) {
            texture.stats.size = getTextureSize(
              texture.internalformat,
              texture.type,
              mipData.width,
              mipData.height,
              texInfo.genMipmaps,
              false);
          }
          reglTexture2D.format = textureFormatsInvert[texture.internalformat];
          reglTexture2D.type = textureTypesInvert[texture.type];

          reglTexture2D.mag = magFiltersInvert[texInfo.magFilter];
          reglTexture2D.min = minFiltersInvert[texInfo.minFilter];

          reglTexture2D.wrapS = wrapModesInvert[texInfo.wrapS];
          reglTexture2D.wrapT = wrapModesInvert[texInfo.wrapT];

          return reglTexture2D
        }

        function subimage (image, x_, y_, level_) {
          check$1(!!image, 'must specify image data');

          var x = x_ | 0;
          var y = y_ | 0;
          var level = level_ | 0;

          var imageData = allocImage();
          copyFlags(imageData, texture);
          imageData.width = 0;
          imageData.height = 0;
          parseImage(imageData, image);
          imageData.width = imageData.width || ((texture.width >> level) - x);
          imageData.height = imageData.height || ((texture.height >> level) - y);

          check$1(
            texture.type === imageData.type &&
            texture.format === imageData.format &&
            texture.internalformat === imageData.internalformat,
            'incompatible format for texture.subimage');
          check$1(
            x >= 0 && y >= 0 &&
            x + imageData.width <= texture.width &&
            y + imageData.height <= texture.height,
            'texture.subimage write out of bounds');
          check$1(
            texture.mipmask & (1 << level),
            'missing mipmap data');
          check$1(
            imageData.data || imageData.element || imageData.needsCopy,
            'missing image data');

          tempBind(texture);
          setSubImage(imageData, GL_TEXTURE_2D$1, x, y, level);
          tempRestore();

          freeImage(imageData);

          return reglTexture2D
        }

        function resize (w_, h_) {
          var w = w_ | 0;
          var h = (h_ | 0) || w;
          if (w === texture.width && h === texture.height) {
            return reglTexture2D
          }

          reglTexture2D.width = texture.width = w;
          reglTexture2D.height = texture.height = h;

          tempBind(texture);

          for (var i = 0; texture.mipmask >> i; ++i) {
            var _w = w >> i;
            var _h = h >> i;
            if (!_w || !_h) break
            gl.texImage2D(
              GL_TEXTURE_2D$1,
              i,
              texture.format,
              _w,
              _h,
              0,
              texture.format,
              texture.type,
              null);
          }
          tempRestore();

          // also, recompute the texture size.
          if (config.profile) {
            texture.stats.size = getTextureSize(
              texture.internalformat,
              texture.type,
              w,
              h,
              false,
              false);
          }

          return reglTexture2D
        }

        reglTexture2D(a, b);

        reglTexture2D.subimage = subimage;
        reglTexture2D.resize = resize;
        reglTexture2D._reglType = 'texture2d';
        reglTexture2D._texture = texture;
        if (config.profile) {
          reglTexture2D.stats = texture.stats;
        }
        reglTexture2D.destroy = function () {
          texture.decRef();
        };

        return reglTexture2D
      }

      function createTextureCube (a0, a1, a2, a3, a4, a5) {
        var texture = new REGLTexture(GL_TEXTURE_CUBE_MAP$1);
        textureSet[texture.id] = texture;
        stats.cubeCount++;

        var faces = new Array(6);

        function reglTextureCube (a0, a1, a2, a3, a4, a5) {
          var i;
          var texInfo = texture.texInfo;
          TexInfo.call(texInfo);
          for (i = 0; i < 6; ++i) {
            faces[i] = allocMipMap();
          }

          if (typeof a0 === 'number' || !a0) {
            var s = (a0 | 0) || 1;
            for (i = 0; i < 6; ++i) {
              parseMipMapFromShape(faces[i], s, s);
            }
          } else if (typeof a0 === 'object') {
            if (a1) {
              parseMipMapFromObject(faces[0], a0);
              parseMipMapFromObject(faces[1], a1);
              parseMipMapFromObject(faces[2], a2);
              parseMipMapFromObject(faces[3], a3);
              parseMipMapFromObject(faces[4], a4);
              parseMipMapFromObject(faces[5], a5);
            } else {
              parseTexInfo(texInfo, a0);
              parseFlags(texture, a0);
              if ('faces' in a0) {
                var faceInput = a0.faces;
                check$1(Array.isArray(faceInput) && faceInput.length === 6,
                  'cube faces must be a length 6 array');
                for (i = 0; i < 6; ++i) {
                  check$1(typeof faceInput[i] === 'object' && !!faceInput[i],
                    'invalid input for cube map face');
                  copyFlags(faces[i], texture);
                  parseMipMapFromObject(faces[i], faceInput[i]);
                }
              } else {
                for (i = 0; i < 6; ++i) {
                  parseMipMapFromObject(faces[i], a0);
                }
              }
            }
          } else {
            check$1.raise('invalid arguments to cube map');
          }

          copyFlags(texture, faces[0]);

          if (!limits.npotTextureCube) {
            check$1(isPow2$1(texture.width) && isPow2$1(texture.height), 'your browser does not support non power or two texture dimensions');
          }

          if (texInfo.genMipmaps) {
            texture.mipmask = (faces[0].width << 1) - 1;
          } else {
            texture.mipmask = faces[0].mipmask;
          }

          check$1.textureCube(texture, texInfo, faces, limits);
          texture.internalformat = faces[0].internalformat;

          reglTextureCube.width = faces[0].width;
          reglTextureCube.height = faces[0].height;

          tempBind(texture);
          for (i = 0; i < 6; ++i) {
            setMipMap(faces[i], GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i);
          }
          setTexInfo(texInfo, GL_TEXTURE_CUBE_MAP$1);
          tempRestore();

          if (config.profile) {
            texture.stats.size = getTextureSize(
              texture.internalformat,
              texture.type,
              reglTextureCube.width,
              reglTextureCube.height,
              texInfo.genMipmaps,
              true);
          }

          reglTextureCube.format = textureFormatsInvert[texture.internalformat];
          reglTextureCube.type = textureTypesInvert[texture.type];

          reglTextureCube.mag = magFiltersInvert[texInfo.magFilter];
          reglTextureCube.min = minFiltersInvert[texInfo.minFilter];

          reglTextureCube.wrapS = wrapModesInvert[texInfo.wrapS];
          reglTextureCube.wrapT = wrapModesInvert[texInfo.wrapT];

          for (i = 0; i < 6; ++i) {
            freeMipMap(faces[i]);
          }

          return reglTextureCube
        }

        function subimage (face, image, x_, y_, level_) {
          check$1(!!image, 'must specify image data');
          check$1(typeof face === 'number' && face === (face | 0) &&
            face >= 0 && face < 6, 'invalid face');

          var x = x_ | 0;
          var y = y_ | 0;
          var level = level_ | 0;

          var imageData = allocImage();
          copyFlags(imageData, texture);
          imageData.width = 0;
          imageData.height = 0;
          parseImage(imageData, image);
          imageData.width = imageData.width || ((texture.width >> level) - x);
          imageData.height = imageData.height || ((texture.height >> level) - y);

          check$1(
            texture.type === imageData.type &&
            texture.format === imageData.format &&
            texture.internalformat === imageData.internalformat,
            'incompatible format for texture.subimage');
          check$1(
            x >= 0 && y >= 0 &&
            x + imageData.width <= texture.width &&
            y + imageData.height <= texture.height,
            'texture.subimage write out of bounds');
          check$1(
            texture.mipmask & (1 << level),
            'missing mipmap data');
          check$1(
            imageData.data || imageData.element || imageData.needsCopy,
            'missing image data');

          tempBind(texture);
          setSubImage(imageData, GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + face, x, y, level);
          tempRestore();

          freeImage(imageData);

          return reglTextureCube
        }

        function resize (radius_) {
          var radius = radius_ | 0;
          if (radius === texture.width) {
            return
          }

          reglTextureCube.width = texture.width = radius;
          reglTextureCube.height = texture.height = radius;

          tempBind(texture);
          for (var i = 0; i < 6; ++i) {
            for (var j = 0; texture.mipmask >> j; ++j) {
              gl.texImage2D(
                GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + i,
                j,
                texture.format,
                radius >> j,
                radius >> j,
                0,
                texture.format,
                texture.type,
                null);
            }
          }
          tempRestore();

          if (config.profile) {
            texture.stats.size = getTextureSize(
              texture.internalformat,
              texture.type,
              reglTextureCube.width,
              reglTextureCube.height,
              false,
              true);
          }

          return reglTextureCube
        }

        reglTextureCube(a0, a1, a2, a3, a4, a5);

        reglTextureCube.subimage = subimage;
        reglTextureCube.resize = resize;
        reglTextureCube._reglType = 'textureCube';
        reglTextureCube._texture = texture;
        if (config.profile) {
          reglTextureCube.stats = texture.stats;
        }
        reglTextureCube.destroy = function () {
          texture.decRef();
        };

        return reglTextureCube
      }

      // Called when regl is destroyed
      function destroyTextures () {
        for (var i = 0; i < numTexUnits; ++i) {
          gl.activeTexture(GL_TEXTURE0$1 + i);
          gl.bindTexture(GL_TEXTURE_2D$1, null);
          textureUnits[i] = null;
        }
        values(textureSet).forEach(destroy);

        stats.cubeCount = 0;
        stats.textureCount = 0;
      }

      if (config.profile) {
        stats.getTotalTextureSize = function () {
          var total = 0;
          Object.keys(textureSet).forEach(function (key) {
            total += textureSet[key].stats.size;
          });
          return total
        };
      }

      function restoreTextures () {
        for (var i = 0; i < numTexUnits; ++i) {
          var tex = textureUnits[i];
          if (tex) {
            tex.bindCount = 0;
            tex.unit = -1;
            textureUnits[i] = null;
          }
        }

        values(textureSet).forEach(function (texture) {
          texture.texture = gl.createTexture();
          gl.bindTexture(texture.target, texture.texture);
          for (var i = 0; i < 32; ++i) {
            if ((texture.mipmask & (1 << i)) === 0) {
              continue
            }
            if (texture.target === GL_TEXTURE_2D$1) {
              gl.texImage2D(GL_TEXTURE_2D$1,
                i,
                texture.internalformat,
                texture.width >> i,
                texture.height >> i,
                0,
                texture.internalformat,
                texture.type,
                null);
            } else {
              for (var j = 0; j < 6; ++j) {
                gl.texImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X$1 + j,
                  i,
                  texture.internalformat,
                  texture.width >> i,
                  texture.height >> i,
                  0,
                  texture.internalformat,
                  texture.type,
                  null);
              }
            }
          }
          setTexInfo(texture.texInfo, texture.target);
        });
      }

      function refreshTextures () {
        for (var i = 0; i < numTexUnits; ++i) {
          var tex = textureUnits[i];
          if (tex) {
            tex.bindCount = 0;
            tex.unit = -1;
            textureUnits[i] = null;
          }
          gl.activeTexture(GL_TEXTURE0$1 + i);
          gl.bindTexture(GL_TEXTURE_2D$1, null);
          gl.bindTexture(GL_TEXTURE_CUBE_MAP$1, null);
        }
      }

      return {
        create2D: createTexture2D,
        createCube: createTextureCube,
        clear: destroyTextures,
        getTexture: function (wrapper) {
          return null
        },
        restore: restoreTextures,
        refresh: refreshTextures
      }
    }

    var GL_RENDERBUFFER = 0x8D41;

    var GL_RGBA4$1 = 0x8056;
    var GL_RGB5_A1$1 = 0x8057;
    var GL_RGB565$1 = 0x8D62;
    var GL_DEPTH_COMPONENT16 = 0x81A5;
    var GL_STENCIL_INDEX8 = 0x8D48;
    var GL_DEPTH_STENCIL$1 = 0x84F9;

    var GL_SRGB8_ALPHA8_EXT = 0x8C43;

    var GL_RGBA32F_EXT = 0x8814;

    var GL_RGBA16F_EXT = 0x881A;
    var GL_RGB16F_EXT = 0x881B;

    var FORMAT_SIZES = [];

    FORMAT_SIZES[GL_RGBA4$1] = 2;
    FORMAT_SIZES[GL_RGB5_A1$1] = 2;
    FORMAT_SIZES[GL_RGB565$1] = 2;

    FORMAT_SIZES[GL_DEPTH_COMPONENT16] = 2;
    FORMAT_SIZES[GL_STENCIL_INDEX8] = 1;
    FORMAT_SIZES[GL_DEPTH_STENCIL$1] = 4;

    FORMAT_SIZES[GL_SRGB8_ALPHA8_EXT] = 4;
    FORMAT_SIZES[GL_RGBA32F_EXT] = 16;
    FORMAT_SIZES[GL_RGBA16F_EXT] = 8;
    FORMAT_SIZES[GL_RGB16F_EXT] = 6;

    function getRenderbufferSize (format, width, height) {
      return FORMAT_SIZES[format] * width * height
    }

    var wrapRenderbuffers = function (gl, extensions, limits, stats, config) {
      var formatTypes = {
        'rgba4': GL_RGBA4$1,
        'rgb565': GL_RGB565$1,
        'rgb5 a1': GL_RGB5_A1$1,
        'depth': GL_DEPTH_COMPONENT16,
        'stencil': GL_STENCIL_INDEX8,
        'depth stencil': GL_DEPTH_STENCIL$1
      };

      if (extensions.ext_srgb) {
        formatTypes['srgba'] = GL_SRGB8_ALPHA8_EXT;
      }

      if (extensions.ext_color_buffer_half_float) {
        formatTypes['rgba16f'] = GL_RGBA16F_EXT;
        formatTypes['rgb16f'] = GL_RGB16F_EXT;
      }

      if (extensions.webgl_color_buffer_float) {
        formatTypes['rgba32f'] = GL_RGBA32F_EXT;
      }

      var formatTypesInvert = [];
      Object.keys(formatTypes).forEach(function (key) {
        var val = formatTypes[key];
        formatTypesInvert[val] = key;
      });

      var renderbufferCount = 0;
      var renderbufferSet = {};

      function REGLRenderbuffer (renderbuffer) {
        this.id = renderbufferCount++;
        this.refCount = 1;

        this.renderbuffer = renderbuffer;

        this.format = GL_RGBA4$1;
        this.width = 0;
        this.height = 0;

        if (config.profile) {
          this.stats = { size: 0 };
        }
      }

      REGLRenderbuffer.prototype.decRef = function () {
        if (--this.refCount <= 0) {
          destroy(this);
        }
      };

      function destroy (rb) {
        var handle = rb.renderbuffer;
        check$1(handle, 'must not double destroy renderbuffer');
        gl.bindRenderbuffer(GL_RENDERBUFFER, null);
        gl.deleteRenderbuffer(handle);
        rb.renderbuffer = null;
        rb.refCount = 0;
        delete renderbufferSet[rb.id];
        stats.renderbufferCount--;
      }

      function createRenderbuffer (a, b) {
        var renderbuffer = new REGLRenderbuffer(gl.createRenderbuffer());
        renderbufferSet[renderbuffer.id] = renderbuffer;
        stats.renderbufferCount++;

        function reglRenderbuffer (a, b) {
          var w = 0;
          var h = 0;
          var format = GL_RGBA4$1;

          if (typeof a === 'object' && a) {
            var options = a;
            if ('shape' in options) {
              var shape = options.shape;
              check$1(Array.isArray(shape) && shape.length >= 2,
                'invalid renderbuffer shape');
              w = shape[0] | 0;
              h = shape[1] | 0;
            } else {
              if ('radius' in options) {
                w = h = options.radius | 0;
              }
              if ('width' in options) {
                w = options.width | 0;
              }
              if ('height' in options) {
                h = options.height | 0;
              }
            }
            if ('format' in options) {
              check$1.parameter(options.format, formatTypes,
                'invalid renderbuffer format');
              format = formatTypes[options.format];
            }
          } else if (typeof a === 'number') {
            w = a | 0;
            if (typeof b === 'number') {
              h = b | 0;
            } else {
              h = w;
            }
          } else if (!a) {
            w = h = 1;
          } else {
            check$1.raise('invalid arguments to renderbuffer constructor');
          }

          // check shape
          check$1(
            w > 0 && h > 0 &&
            w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize,
            'invalid renderbuffer size');

          if (w === renderbuffer.width &&
              h === renderbuffer.height &&
              format === renderbuffer.format) {
            return
          }

          reglRenderbuffer.width = renderbuffer.width = w;
          reglRenderbuffer.height = renderbuffer.height = h;
          renderbuffer.format = format;

          gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
          gl.renderbufferStorage(GL_RENDERBUFFER, format, w, h);

          check$1(
            gl.getError() === 0,
            'invalid render buffer format');

          if (config.profile) {
            renderbuffer.stats.size = getRenderbufferSize(renderbuffer.format, renderbuffer.width, renderbuffer.height);
          }
          reglRenderbuffer.format = formatTypesInvert[renderbuffer.format];

          return reglRenderbuffer
        }

        function resize (w_, h_) {
          var w = w_ | 0;
          var h = (h_ | 0) || w;

          if (w === renderbuffer.width && h === renderbuffer.height) {
            return reglRenderbuffer
          }

          // check shape
          check$1(
            w > 0 && h > 0 &&
            w <= limits.maxRenderbufferSize && h <= limits.maxRenderbufferSize,
            'invalid renderbuffer size');

          reglRenderbuffer.width = renderbuffer.width = w;
          reglRenderbuffer.height = renderbuffer.height = h;

          gl.bindRenderbuffer(GL_RENDERBUFFER, renderbuffer.renderbuffer);
          gl.renderbufferStorage(GL_RENDERBUFFER, renderbuffer.format, w, h);

          check$1(
            gl.getError() === 0,
            'invalid render buffer format');

          // also, recompute size.
          if (config.profile) {
            renderbuffer.stats.size = getRenderbufferSize(
              renderbuffer.format, renderbuffer.width, renderbuffer.height);
          }

          return reglRenderbuffer
        }

        reglRenderbuffer(a, b);

        reglRenderbuffer.resize = resize;
        reglRenderbuffer._reglType = 'renderbuffer';
        reglRenderbuffer._renderbuffer = renderbuffer;
        if (config.profile) {
          reglRenderbuffer.stats = renderbuffer.stats;
        }
        reglRenderbuffer.destroy = function () {
          renderbuffer.decRef();
        };

        return reglRenderbuffer
      }

      if (config.profile) {
        stats.getTotalRenderbufferSize = function () {
          var total = 0;
          Object.keys(renderbufferSet).forEach(function (key) {
            total += renderbufferSet[key].stats.size;
          });
          return total
        };
      }

      function restoreRenderbuffers () {
        values(renderbufferSet).forEach(function (rb) {
          rb.renderbuffer = gl.createRenderbuffer();
          gl.bindRenderbuffer(GL_RENDERBUFFER, rb.renderbuffer);
          gl.renderbufferStorage(GL_RENDERBUFFER, rb.format, rb.width, rb.height);
        });
        gl.bindRenderbuffer(GL_RENDERBUFFER, null);
      }

      return {
        create: createRenderbuffer,
        clear: function () {
          values(renderbufferSet).forEach(destroy);
        },
        restore: restoreRenderbuffers
      }
    };

    // We store these constants so that the minifier can inline them
    var GL_FRAMEBUFFER$1 = 0x8D40;
    var GL_RENDERBUFFER$1 = 0x8D41;

    var GL_TEXTURE_2D$2 = 0x0DE1;
    var GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 = 0x8515;

    var GL_COLOR_ATTACHMENT0$1 = 0x8CE0;
    var GL_DEPTH_ATTACHMENT = 0x8D00;
    var GL_STENCIL_ATTACHMENT = 0x8D20;
    var GL_DEPTH_STENCIL_ATTACHMENT = 0x821A;

    var GL_FRAMEBUFFER_COMPLETE$1 = 0x8CD5;
    var GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT = 0x8CD6;
    var GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = 0x8CD7;
    var GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS = 0x8CD9;
    var GL_FRAMEBUFFER_UNSUPPORTED = 0x8CDD;

    var GL_HALF_FLOAT_OES$2 = 0x8D61;
    var GL_UNSIGNED_BYTE$6 = 0x1401;
    var GL_FLOAT$5 = 0x1406;

    var GL_RGB$1 = 0x1907;
    var GL_RGBA$2 = 0x1908;

    var GL_DEPTH_COMPONENT$1 = 0x1902;

    var colorTextureFormatEnums = [
      GL_RGB$1,
      GL_RGBA$2
    ];

    // for every texture format, store
    // the number of channels
    var textureFormatChannels = [];
    textureFormatChannels[GL_RGBA$2] = 4;
    textureFormatChannels[GL_RGB$1] = 3;

    // for every texture type, store
    // the size in bytes.
    var textureTypeSizes = [];
    textureTypeSizes[GL_UNSIGNED_BYTE$6] = 1;
    textureTypeSizes[GL_FLOAT$5] = 4;
    textureTypeSizes[GL_HALF_FLOAT_OES$2] = 2;

    var GL_RGBA4$2 = 0x8056;
    var GL_RGB5_A1$2 = 0x8057;
    var GL_RGB565$2 = 0x8D62;
    var GL_DEPTH_COMPONENT16$1 = 0x81A5;
    var GL_STENCIL_INDEX8$1 = 0x8D48;
    var GL_DEPTH_STENCIL$2 = 0x84F9;

    var GL_SRGB8_ALPHA8_EXT$1 = 0x8C43;

    var GL_RGBA32F_EXT$1 = 0x8814;

    var GL_RGBA16F_EXT$1 = 0x881A;
    var GL_RGB16F_EXT$1 = 0x881B;

    var colorRenderbufferFormatEnums = [
      GL_RGBA4$2,
      GL_RGB5_A1$2,
      GL_RGB565$2,
      GL_SRGB8_ALPHA8_EXT$1,
      GL_RGBA16F_EXT$1,
      GL_RGB16F_EXT$1,
      GL_RGBA32F_EXT$1
    ];

    var statusCode = {};
    statusCode[GL_FRAMEBUFFER_COMPLETE$1] = 'complete';
    statusCode[GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT] = 'incomplete attachment';
    statusCode[GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS] = 'incomplete dimensions';
    statusCode[GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT] = 'incomplete, missing attachment';
    statusCode[GL_FRAMEBUFFER_UNSUPPORTED] = 'unsupported';

    function wrapFBOState (
      gl,
      extensions,
      limits,
      textureState,
      renderbufferState,
      stats) {
      var framebufferState = {
        cur: null,
        next: null,
        dirty: false,
        setFBO: null
      };

      var colorTextureFormats = ['rgba'];
      var colorRenderbufferFormats = ['rgba4', 'rgb565', 'rgb5 a1'];

      if (extensions.ext_srgb) {
        colorRenderbufferFormats.push('srgba');
      }

      if (extensions.ext_color_buffer_half_float) {
        colorRenderbufferFormats.push('rgba16f', 'rgb16f');
      }

      if (extensions.webgl_color_buffer_float) {
        colorRenderbufferFormats.push('rgba32f');
      }

      var colorTypes = ['uint8'];
      if (extensions.oes_texture_half_float) {
        colorTypes.push('half float', 'float16');
      }
      if (extensions.oes_texture_float) {
        colorTypes.push('float', 'float32');
      }

      function FramebufferAttachment (target, texture, renderbuffer) {
        this.target = target;
        this.texture = texture;
        this.renderbuffer = renderbuffer;

        var w = 0;
        var h = 0;
        if (texture) {
          w = texture.width;
          h = texture.height;
        } else if (renderbuffer) {
          w = renderbuffer.width;
          h = renderbuffer.height;
        }
        this.width = w;
        this.height = h;
      }

      function decRef (attachment) {
        if (attachment) {
          if (attachment.texture) {
            attachment.texture._texture.decRef();
          }
          if (attachment.renderbuffer) {
            attachment.renderbuffer._renderbuffer.decRef();
          }
        }
      }

      function incRefAndCheckShape (attachment, width, height) {
        if (!attachment) {
          return
        }
        if (attachment.texture) {
          var texture = attachment.texture._texture;
          var tw = Math.max(1, texture.width);
          var th = Math.max(1, texture.height);
          check$1(tw === width && th === height,
            'inconsistent width/height for supplied texture');
          texture.refCount += 1;
        } else {
          var renderbuffer = attachment.renderbuffer._renderbuffer;
          check$1(
            renderbuffer.width === width && renderbuffer.height === height,
            'inconsistent width/height for renderbuffer');
          renderbuffer.refCount += 1;
        }
      }

      function attach (location, attachment) {
        if (attachment) {
          if (attachment.texture) {
            gl.framebufferTexture2D(
              GL_FRAMEBUFFER$1,
              location,
              attachment.target,
              attachment.texture._texture.texture,
              0);
          } else {
            gl.framebufferRenderbuffer(
              GL_FRAMEBUFFER$1,
              location,
              GL_RENDERBUFFER$1,
              attachment.renderbuffer._renderbuffer.renderbuffer);
          }
        }
      }

      function parseAttachment (attachment) {
        var target = GL_TEXTURE_2D$2;
        var texture = null;
        var renderbuffer = null;

        var data = attachment;
        if (typeof attachment === 'object') {
          data = attachment.data;
          if ('target' in attachment) {
            target = attachment.target | 0;
          }
        }

        check$1.type(data, 'function', 'invalid attachment data');

        var type = data._reglType;
        if (type === 'texture2d') {
          texture = data;
          check$1(target === GL_TEXTURE_2D$2);
        } else if (type === 'textureCube') {
          texture = data;
          check$1(
            target >= GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 &&
            target < GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + 6,
            'invalid cube map target');
        } else if (type === 'renderbuffer') {
          renderbuffer = data;
          target = GL_RENDERBUFFER$1;
        } else {
          check$1.raise('invalid regl object for attachment');
        }

        return new FramebufferAttachment(target, texture, renderbuffer)
      }

      function allocAttachment (
        width,
        height,
        isTexture,
        format,
        type) {
        if (isTexture) {
          var texture = textureState.create2D({
            width: width,
            height: height,
            format: format,
            type: type
          });
          texture._texture.refCount = 0;
          return new FramebufferAttachment(GL_TEXTURE_2D$2, texture, null)
        } else {
          var rb = renderbufferState.create({
            width: width,
            height: height,
            format: format
          });
          rb._renderbuffer.refCount = 0;
          return new FramebufferAttachment(GL_RENDERBUFFER$1, null, rb)
        }
      }

      function unwrapAttachment (attachment) {
        return attachment && (attachment.texture || attachment.renderbuffer)
      }

      function resizeAttachment (attachment, w, h) {
        if (attachment) {
          if (attachment.texture) {
            attachment.texture.resize(w, h);
          } else if (attachment.renderbuffer) {
            attachment.renderbuffer.resize(w, h);
          }
          attachment.width = w;
          attachment.height = h;
        }
      }

      var framebufferCount = 0;
      var framebufferSet = {};

      function REGLFramebuffer () {
        this.id = framebufferCount++;
        framebufferSet[this.id] = this;

        this.framebuffer = gl.createFramebuffer();
        this.width = 0;
        this.height = 0;

        this.colorAttachments = [];
        this.depthAttachment = null;
        this.stencilAttachment = null;
        this.depthStencilAttachment = null;
      }

      function decFBORefs (framebuffer) {
        framebuffer.colorAttachments.forEach(decRef);
        decRef(framebuffer.depthAttachment);
        decRef(framebuffer.stencilAttachment);
        decRef(framebuffer.depthStencilAttachment);
      }

      function destroy (framebuffer) {
        var handle = framebuffer.framebuffer;
        check$1(handle, 'must not double destroy framebuffer');
        gl.deleteFramebuffer(handle);
        framebuffer.framebuffer = null;
        stats.framebufferCount--;
        delete framebufferSet[framebuffer.id];
      }

      function updateFramebuffer (framebuffer) {
        var i;

        gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebuffer.framebuffer);
        var colorAttachments = framebuffer.colorAttachments;
        for (i = 0; i < colorAttachments.length; ++i) {
          attach(GL_COLOR_ATTACHMENT0$1 + i, colorAttachments[i]);
        }
        for (i = colorAttachments.length; i < limits.maxColorAttachments; ++i) {
          gl.framebufferTexture2D(
            GL_FRAMEBUFFER$1,
            GL_COLOR_ATTACHMENT0$1 + i,
            GL_TEXTURE_2D$2,
            null,
            0);
        }

        gl.framebufferTexture2D(
          GL_FRAMEBUFFER$1,
          GL_DEPTH_STENCIL_ATTACHMENT,
          GL_TEXTURE_2D$2,
          null,
          0);
        gl.framebufferTexture2D(
          GL_FRAMEBUFFER$1,
          GL_DEPTH_ATTACHMENT,
          GL_TEXTURE_2D$2,
          null,
          0);
        gl.framebufferTexture2D(
          GL_FRAMEBUFFER$1,
          GL_STENCIL_ATTACHMENT,
          GL_TEXTURE_2D$2,
          null,
          0);

        attach(GL_DEPTH_ATTACHMENT, framebuffer.depthAttachment);
        attach(GL_STENCIL_ATTACHMENT, framebuffer.stencilAttachment);
        attach(GL_DEPTH_STENCIL_ATTACHMENT, framebuffer.depthStencilAttachment);

        // Check status code
        var status = gl.checkFramebufferStatus(GL_FRAMEBUFFER$1);
        if (!gl.isContextLost() && status !== GL_FRAMEBUFFER_COMPLETE$1) {
          check$1.raise('framebuffer configuration not supported, status = ' +
            statusCode[status]);
        }

        gl.bindFramebuffer(GL_FRAMEBUFFER$1, framebufferState.next ? framebufferState.next.framebuffer : null);
        framebufferState.cur = framebufferState.next;

        // FIXME: Clear error code here.  This is a work around for a bug in
        // headless-gl
        gl.getError();
      }

      function createFBO (a0, a1) {
        var framebuffer = new REGLFramebuffer();
        stats.framebufferCount++;

        function reglFramebuffer (a, b) {
          var i;

          check$1(framebufferState.next !== framebuffer,
            'can not update framebuffer which is currently in use');

          var width = 0;
          var height = 0;

          var needsDepth = true;
          var needsStencil = true;

          var colorBuffer = null;
          var colorTexture = true;
          var colorFormat = 'rgba';
          var colorType = 'uint8';
          var colorCount = 1;

          var depthBuffer = null;
          var stencilBuffer = null;
          var depthStencilBuffer = null;
          var depthStencilTexture = false;

          if (typeof a === 'number') {
            width = a | 0;
            height = (b | 0) || width;
          } else if (!a) {
            width = height = 1;
          } else {
            check$1.type(a, 'object', 'invalid arguments for framebuffer');
            var options = a;

            if ('shape' in options) {
              var shape = options.shape;
              check$1(Array.isArray(shape) && shape.length >= 2,
                'invalid shape for framebuffer');
              width = shape[0];
              height = shape[1];
            } else {
              if ('radius' in options) {
                width = height = options.radius;
              }
              if ('width' in options) {
                width = options.width;
              }
              if ('height' in options) {
                height = options.height;
              }
            }

            if ('color' in options ||
                'colors' in options) {
              colorBuffer =
                options.color ||
                options.colors;
              if (Array.isArray(colorBuffer)) {
                check$1(
                  colorBuffer.length === 1 || extensions.webgl_draw_buffers,
                  'multiple render targets not supported');
              }
            }

            if (!colorBuffer) {
              if ('colorCount' in options) {
                colorCount = options.colorCount | 0;
                check$1(colorCount > 0, 'invalid color buffer count');
              }

              if ('colorTexture' in options) {
                colorTexture = !!options.colorTexture;
                colorFormat = 'rgba4';
              }

              if ('colorType' in options) {
                colorType = options.colorType;
                if (!colorTexture) {
                  if (colorType === 'half float' || colorType === 'float16') {
                    check$1(extensions.ext_color_buffer_half_float,
                      'you must enable EXT_color_buffer_half_float to use 16-bit render buffers');
                    colorFormat = 'rgba16f';
                  } else if (colorType === 'float' || colorType === 'float32') {
                    check$1(extensions.webgl_color_buffer_float,
                      'you must enable WEBGL_color_buffer_float in order to use 32-bit floating point renderbuffers');
                    colorFormat = 'rgba32f';
                  }
                } else {
                  check$1(extensions.oes_texture_float ||
                    !(colorType === 'float' || colorType === 'float32'),
                  'you must enable OES_texture_float in order to use floating point framebuffer objects');
                  check$1(extensions.oes_texture_half_float ||
                    !(colorType === 'half float' || colorType === 'float16'),
                  'you must enable OES_texture_half_float in order to use 16-bit floating point framebuffer objects');
                }
                check$1.oneOf(colorType, colorTypes, 'invalid color type');
              }

              if ('colorFormat' in options) {
                colorFormat = options.colorFormat;
                if (colorTextureFormats.indexOf(colorFormat) >= 0) {
                  colorTexture = true;
                } else if (colorRenderbufferFormats.indexOf(colorFormat) >= 0) {
                  colorTexture = false;
                } else {
                  if (colorTexture) {
                    check$1.oneOf(
                      options.colorFormat, colorTextureFormats,
                      'invalid color format for texture');
                  } else {
                    check$1.oneOf(
                      options.colorFormat, colorRenderbufferFormats,
                      'invalid color format for renderbuffer');
                  }
                }
              }
            }

            if ('depthTexture' in options || 'depthStencilTexture' in options) {
              depthStencilTexture = !!(options.depthTexture ||
                options.depthStencilTexture);
              check$1(!depthStencilTexture || extensions.webgl_depth_texture,
                'webgl_depth_texture extension not supported');
            }

            if ('depth' in options) {
              if (typeof options.depth === 'boolean') {
                needsDepth = options.depth;
              } else {
                depthBuffer = options.depth;
                needsStencil = false;
              }
            }

            if ('stencil' in options) {
              if (typeof options.stencil === 'boolean') {
                needsStencil = options.stencil;
              } else {
                stencilBuffer = options.stencil;
                needsDepth = false;
              }
            }

            if ('depthStencil' in options) {
              if (typeof options.depthStencil === 'boolean') {
                needsDepth = needsStencil = options.depthStencil;
              } else {
                depthStencilBuffer = options.depthStencil;
                needsDepth = false;
                needsStencil = false;
              }
            }
          }

          // parse attachments
          var colorAttachments = null;
          var depthAttachment = null;
          var stencilAttachment = null;
          var depthStencilAttachment = null;

          // Set up color attachments
          if (Array.isArray(colorBuffer)) {
            colorAttachments = colorBuffer.map(parseAttachment);
          } else if (colorBuffer) {
            colorAttachments = [parseAttachment(colorBuffer)];
          } else {
            colorAttachments = new Array(colorCount);
            for (i = 0; i < colorCount; ++i) {
              colorAttachments[i] = allocAttachment(
                width,
                height,
                colorTexture,
                colorFormat,
                colorType);
            }
          }

          check$1(extensions.webgl_draw_buffers || colorAttachments.length <= 1,
            'you must enable the WEBGL_draw_buffers extension in order to use multiple color buffers.');
          check$1(colorAttachments.length <= limits.maxColorAttachments,
            'too many color attachments, not supported');

          width = width || colorAttachments[0].width;
          height = height || colorAttachments[0].height;

          if (depthBuffer) {
            depthAttachment = parseAttachment(depthBuffer);
          } else if (needsDepth && !needsStencil) {
            depthAttachment = allocAttachment(
              width,
              height,
              depthStencilTexture,
              'depth',
              'uint32');
          }

          if (stencilBuffer) {
            stencilAttachment = parseAttachment(stencilBuffer);
          } else if (needsStencil && !needsDepth) {
            stencilAttachment = allocAttachment(
              width,
              height,
              false,
              'stencil',
              'uint8');
          }

          if (depthStencilBuffer) {
            depthStencilAttachment = parseAttachment(depthStencilBuffer);
          } else if (!depthBuffer && !stencilBuffer && needsStencil && needsDepth) {
            depthStencilAttachment = allocAttachment(
              width,
              height,
              depthStencilTexture,
              'depth stencil',
              'depth stencil');
          }

          check$1(
            (!!depthBuffer) + (!!stencilBuffer) + (!!depthStencilBuffer) <= 1,
            'invalid framebuffer configuration, can specify exactly one depth/stencil attachment');

          var commonColorAttachmentSize = null;

          for (i = 0; i < colorAttachments.length; ++i) {
            incRefAndCheckShape(colorAttachments[i], width, height);
            check$1(!colorAttachments[i] ||
              (colorAttachments[i].texture &&
                colorTextureFormatEnums.indexOf(colorAttachments[i].texture._texture.format) >= 0) ||
              (colorAttachments[i].renderbuffer &&
                colorRenderbufferFormatEnums.indexOf(colorAttachments[i].renderbuffer._renderbuffer.format) >= 0),
            'framebuffer color attachment ' + i + ' is invalid');

            if (colorAttachments[i] && colorAttachments[i].texture) {
              var colorAttachmentSize =
                  textureFormatChannels[colorAttachments[i].texture._texture.format] *
                  textureTypeSizes[colorAttachments[i].texture._texture.type];

              if (commonColorAttachmentSize === null) {
                commonColorAttachmentSize = colorAttachmentSize;
              } else {
                // We need to make sure that all color attachments have the same number of bitplanes
                // (that is, the same numer of bits per pixel)
                // This is required by the GLES2.0 standard. See the beginning of Chapter 4 in that document.
                check$1(commonColorAttachmentSize === colorAttachmentSize,
                  'all color attachments much have the same number of bits per pixel.');
              }
            }
          }
          incRefAndCheckShape(depthAttachment, width, height);
          check$1(!depthAttachment ||
            (depthAttachment.texture &&
              depthAttachment.texture._texture.format === GL_DEPTH_COMPONENT$1) ||
            (depthAttachment.renderbuffer &&
              depthAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_COMPONENT16$1),
          'invalid depth attachment for framebuffer object');
          incRefAndCheckShape(stencilAttachment, width, height);
          check$1(!stencilAttachment ||
            (stencilAttachment.renderbuffer &&
              stencilAttachment.renderbuffer._renderbuffer.format === GL_STENCIL_INDEX8$1),
          'invalid stencil attachment for framebuffer object');
          incRefAndCheckShape(depthStencilAttachment, width, height);
          check$1(!depthStencilAttachment ||
            (depthStencilAttachment.texture &&
              depthStencilAttachment.texture._texture.format === GL_DEPTH_STENCIL$2) ||
            (depthStencilAttachment.renderbuffer &&
              depthStencilAttachment.renderbuffer._renderbuffer.format === GL_DEPTH_STENCIL$2),
          'invalid depth-stencil attachment for framebuffer object');

          // decrement references
          decFBORefs(framebuffer);

          framebuffer.width = width;
          framebuffer.height = height;

          framebuffer.colorAttachments = colorAttachments;
          framebuffer.depthAttachment = depthAttachment;
          framebuffer.stencilAttachment = stencilAttachment;
          framebuffer.depthStencilAttachment = depthStencilAttachment;

          reglFramebuffer.color = colorAttachments.map(unwrapAttachment);
          reglFramebuffer.depth = unwrapAttachment(depthAttachment);
          reglFramebuffer.stencil = unwrapAttachment(stencilAttachment);
          reglFramebuffer.depthStencil = unwrapAttachment(depthStencilAttachment);

          reglFramebuffer.width = framebuffer.width;
          reglFramebuffer.height = framebuffer.height;

          updateFramebuffer(framebuffer);

          return reglFramebuffer
        }

        function resize (w_, h_) {
          check$1(framebufferState.next !== framebuffer,
            'can not resize a framebuffer which is currently in use');

          var w = Math.max(w_ | 0, 1);
          var h = Math.max((h_ | 0) || w, 1);
          if (w === framebuffer.width && h === framebuffer.height) {
            return reglFramebuffer
          }

          // resize all buffers
          var colorAttachments = framebuffer.colorAttachments;
          for (var i = 0; i < colorAttachments.length; ++i) {
            resizeAttachment(colorAttachments[i], w, h);
          }
          resizeAttachment(framebuffer.depthAttachment, w, h);
          resizeAttachment(framebuffer.stencilAttachment, w, h);
          resizeAttachment(framebuffer.depthStencilAttachment, w, h);

          framebuffer.width = reglFramebuffer.width = w;
          framebuffer.height = reglFramebuffer.height = h;

          updateFramebuffer(framebuffer);

          return reglFramebuffer
        }

        reglFramebuffer(a0, a1);

        return extend(reglFramebuffer, {
          resize: resize,
          _reglType: 'framebuffer',
          _framebuffer: framebuffer,
          destroy: function () {
            destroy(framebuffer);
            decFBORefs(framebuffer);
          },
          use: function (block) {
            framebufferState.setFBO({
              framebuffer: reglFramebuffer
            }, block);
          }
        })
      }

      function createCubeFBO (options) {
        var faces = Array(6);

        function reglFramebufferCube (a) {
          var i;

          check$1(faces.indexOf(framebufferState.next) < 0,
            'can not update framebuffer which is currently in use');

          var params = {
            color: null
          };

          var radius = 0;

          var colorBuffer = null;
          var colorFormat = 'rgba';
          var colorType = 'uint8';
          var colorCount = 1;

          if (typeof a === 'number') {
            radius = a | 0;
          } else if (!a) {
            radius = 1;
          } else {
            check$1.type(a, 'object', 'invalid arguments for framebuffer');
            var options = a;

            if ('shape' in options) {
              var shape = options.shape;
              check$1(
                Array.isArray(shape) && shape.length >= 2,
                'invalid shape for framebuffer');
              check$1(
                shape[0] === shape[1],
                'cube framebuffer must be square');
              radius = shape[0];
            } else {
              if ('radius' in options) {
                radius = options.radius | 0;
              }
              if ('width' in options) {
                radius = options.width | 0;
                if ('height' in options) {
                  check$1(options.height === radius, 'must be square');
                }
              } else if ('height' in options) {
                radius = options.height | 0;
              }
            }

            if ('color' in options ||
                'colors' in options) {
              colorBuffer =
                options.color ||
                options.colors;
              if (Array.isArray(colorBuffer)) {
                check$1(
                  colorBuffer.length === 1 || extensions.webgl_draw_buffers,
                  'multiple render targets not supported');
              }
            }

            if (!colorBuffer) {
              if ('colorCount' in options) {
                colorCount = options.colorCount | 0;
                check$1(colorCount > 0, 'invalid color buffer count');
              }

              if ('colorType' in options) {
                check$1.oneOf(
                  options.colorType, colorTypes,
                  'invalid color type');
                colorType = options.colorType;
              }

              if ('colorFormat' in options) {
                colorFormat = options.colorFormat;
                check$1.oneOf(
                  options.colorFormat, colorTextureFormats,
                  'invalid color format for texture');
              }
            }

            if ('depth' in options) {
              params.depth = options.depth;
            }

            if ('stencil' in options) {
              params.stencil = options.stencil;
            }

            if ('depthStencil' in options) {
              params.depthStencil = options.depthStencil;
            }
          }

          var colorCubes;
          if (colorBuffer) {
            if (Array.isArray(colorBuffer)) {
              colorCubes = [];
              for (i = 0; i < colorBuffer.length; ++i) {
                colorCubes[i] = colorBuffer[i];
              }
            } else {
              colorCubes = [ colorBuffer ];
            }
          } else {
            colorCubes = Array(colorCount);
            var cubeMapParams = {
              radius: radius,
              format: colorFormat,
              type: colorType
            };
            for (i = 0; i < colorCount; ++i) {
              colorCubes[i] = textureState.createCube(cubeMapParams);
            }
          }

          // Check color cubes
          params.color = Array(colorCubes.length);
          for (i = 0; i < colorCubes.length; ++i) {
            var cube = colorCubes[i];
            check$1(
              typeof cube === 'function' && cube._reglType === 'textureCube',
              'invalid cube map');
            radius = radius || cube.width;
            check$1(
              cube.width === radius && cube.height === radius,
              'invalid cube map shape');
            params.color[i] = {
              target: GL_TEXTURE_CUBE_MAP_POSITIVE_X$2,
              data: colorCubes[i]
            };
          }

          for (i = 0; i < 6; ++i) {
            for (var j = 0; j < colorCubes.length; ++j) {
              params.color[j].target = GL_TEXTURE_CUBE_MAP_POSITIVE_X$2 + i;
            }
            // reuse depth-stencil attachments across all cube maps
            if (i > 0) {
              params.depth = faces[0].depth;
              params.stencil = faces[0].stencil;
              params.depthStencil = faces[0].depthStencil;
            }
            if (faces[i]) {
              (faces[i])(params);
            } else {
              faces[i] = createFBO(params);
            }
          }

          return extend(reglFramebufferCube, {
            width: radius,
            height: radius,
            color: colorCubes
          })
        }

        function resize (radius_) {
          var i;
          var radius = radius_ | 0;
          check$1(radius > 0 && radius <= limits.maxCubeMapSize,
            'invalid radius for cube fbo');

          if (radius === reglFramebufferCube.width) {
            return reglFramebufferCube
          }

          var colors = reglFramebufferCube.color;
          for (i = 0; i < colors.length; ++i) {
            colors[i].resize(radius);
          }

          for (i = 0; i < 6; ++i) {
            faces[i].resize(radius);
          }

          reglFramebufferCube.width = reglFramebufferCube.height = radius;

          return reglFramebufferCube
        }

        reglFramebufferCube(options);

        return extend(reglFramebufferCube, {
          faces: faces,
          resize: resize,
          _reglType: 'framebufferCube',
          destroy: function () {
            faces.forEach(function (f) {
              f.destroy();
            });
          }
        })
      }

      function restoreFramebuffers () {
        framebufferState.cur = null;
        framebufferState.next = null;
        framebufferState.dirty = true;
        values(framebufferSet).forEach(function (fb) {
          fb.framebuffer = gl.createFramebuffer();
          updateFramebuffer(fb);
        });
      }

      return extend(framebufferState, {
        getFramebuffer: function (object) {
          if (typeof object === 'function' && object._reglType === 'framebuffer') {
            var fbo = object._framebuffer;
            if (fbo instanceof REGLFramebuffer) {
              return fbo
            }
          }
          return null
        },
        create: createFBO,
        createCube: createCubeFBO,
        clear: function () {
          values(framebufferSet).forEach(destroy);
        },
        restore: restoreFramebuffers
      })
    }

    var GL_FLOAT$6 = 5126;
    var GL_ARRAY_BUFFER$1 = 34962;

    function AttributeRecord () {
      this.state = 0;

      this.x = 0.0;
      this.y = 0.0;
      this.z = 0.0;
      this.w = 0.0;

      this.buffer = null;
      this.size = 0;
      this.normalized = false;
      this.type = GL_FLOAT$6;
      this.offset = 0;
      this.stride = 0;
      this.divisor = 0;
    }

    function wrapAttributeState (
      gl,
      extensions,
      limits,
      stats,
      bufferState) {
      var NUM_ATTRIBUTES = limits.maxAttributes;
      var attributeBindings = new Array(NUM_ATTRIBUTES);
      for (var i = 0; i < NUM_ATTRIBUTES; ++i) {
        attributeBindings[i] = new AttributeRecord();
      }
      var vaoCount = 0;
      var vaoSet = {};

      var state = {
        Record: AttributeRecord,
        scope: {},
        state: attributeBindings,
        currentVAO: null,
        targetVAO: null,
        restore: extVAO() ? restoreVAO : function () {},
        createVAO: createVAO,
        getVAO: getVAO,
        destroyBuffer: destroyBuffer,
        setVAO: extVAO() ? setVAOEXT : setVAOEmulated,
        clear: extVAO() ? destroyVAOEXT : function () {}
      };

      function destroyBuffer (buffer) {
        for (var i = 0; i < attributeBindings.length; ++i) {
          var record = attributeBindings[i];
          if (record.buffer === buffer) {
            gl.disableVertexAttribArray(i);
            record.buffer = null;
          }
        }
      }

      function extVAO () {
        return extensions.oes_vertex_array_object
      }

      function extInstanced () {
        return extensions.angle_instanced_arrays
      }

      function getVAO (vao) {
        if (typeof vao === 'function' && vao._vao) {
          return vao._vao
        }
        return null
      }

      function setVAOEXT (vao) {
        if (vao === state.currentVAO) {
          return
        }
        var ext = extVAO();
        if (vao) {
          ext.bindVertexArrayOES(vao.vao);
        } else {
          ext.bindVertexArrayOES(null);
        }
        state.currentVAO = vao;
      }

      function setVAOEmulated (vao) {
        if (vao === state.currentVAO) {
          return
        }
        if (vao) {
          vao.bindAttrs();
        } else {
          var exti = extInstanced();
          for (var i = 0; i < attributeBindings.length; ++i) {
            var binding = attributeBindings[i];
            if (binding.buffer) {
              gl.enableVertexAttribArray(i);
              gl.vertexAttribPointer(i, binding.size, binding.type, binding.normalized, binding.stride, binding.offfset);
              if (exti && binding.divisor) {
                exti.vertexAttribDivisorANGLE(i, binding.divisor);
              }
            } else {
              gl.disableVertexAttribArray(i);
              gl.vertexAttrib4f(i, binding.x, binding.y, binding.z, binding.w);
            }
          }
        }
        state.currentVAO = vao;
      }

      function destroyVAOEXT () {
        values(vaoSet).forEach(function (vao) {
          vao.destroy();
        });
      }

      function REGLVAO () {
        this.id = ++vaoCount;
        this.attributes = [];
        var extension = extVAO();
        if (extension) {
          this.vao = extension.createVertexArrayOES();
        } else {
          this.vao = null;
        }
        vaoSet[this.id] = this;
        this.buffers = [];
      }

      REGLVAO.prototype.bindAttrs = function () {
        var exti = extInstanced();
        var attributes = this.attributes;
        for (var i = 0; i < attributes.length; ++i) {
          var attr = attributes[i];
          if (attr.buffer) {
            gl.enableVertexAttribArray(i);
            gl.bindBuffer(GL_ARRAY_BUFFER$1, attr.buffer.buffer);
            gl.vertexAttribPointer(i, attr.size, attr.type, attr.normalized, attr.stride, attr.offset);
            if (exti && attr.divisor) {
              exti.vertexAttribDivisorANGLE(i, attr.divisor);
            }
          } else {
            gl.disableVertexAttribArray(i);
            gl.vertexAttrib4f(i, attr.x, attr.y, attr.z, attr.w);
          }
        }
        for (var j = attributes.length; j < NUM_ATTRIBUTES; ++j) {
          gl.disableVertexAttribArray(j);
        }
      };

      REGLVAO.prototype.refresh = function () {
        var ext = extVAO();
        if (ext) {
          ext.bindVertexArrayOES(this.vao);
          this.bindAttrs();
          state.currentVAO = this;
        }
      };

      REGLVAO.prototype.destroy = function () {
        if (this.vao) {
          var extension = extVAO();
          if (this === state.currentVAO) {
            state.currentVAO = null;
            extension.bindVertexArrayOES(null);
          }
          extension.deleteVertexArrayOES(this.vao);
          this.vao = null;
        }
        if (vaoSet[this.id]) {
          delete vaoSet[this.id];
          stats.vaoCount -= 1;
        }
      };

      function restoreVAO () {
        var ext = extVAO();
        if (ext) {
          values(vaoSet).forEach(function (vao) {
            vao.refresh();
          });
        }
      }

      function createVAO (_attr) {
        var vao = new REGLVAO();
        stats.vaoCount += 1;

        function updateVAO (attributes) {
          check$1(Array.isArray(attributes), 'arguments to vertex array constructor must be an array');
          check$1(attributes.length < NUM_ATTRIBUTES, 'too many attributes');
          check$1(attributes.length > 0, 'must specify at least one attribute');

          var bufUpdated = {};
          var nattributes = vao.attributes;
          nattributes.length = attributes.length;
          for (var i = 0; i < attributes.length; ++i) {
            var spec = attributes[i];
            var rec = nattributes[i] = new AttributeRecord();
            var data = spec.data || spec;
            if (Array.isArray(data) || isTypedArray(data) || isNDArrayLike(data)) {
              var buf;
              if (vao.buffers[i]) {
                buf = vao.buffers[i];
                if (isTypedArray(data) && buf._buffer.byteLength >= data.byteLength) {
                  buf.subdata(data);
                } else {
                  buf.destroy();
                  vao.buffers[i] = null;
                }
              }
              if (!vao.buffers[i]) {
                buf = vao.buffers[i] = bufferState.create(spec, GL_ARRAY_BUFFER$1, false, true);
              }
              rec.buffer = bufferState.getBuffer(buf);
              rec.size = rec.buffer.dimension | 0;
              rec.normalized = false;
              rec.type = rec.buffer.dtype;
              rec.offset = 0;
              rec.stride = 0;
              rec.divisor = 0;
              rec.state = 1;
              bufUpdated[i] = 1;
            } else if (bufferState.getBuffer(spec)) {
              rec.buffer = bufferState.getBuffer(spec);
              rec.size = rec.buffer.dimension | 0;
              rec.normalized = false;
              rec.type = rec.buffer.dtype;
              rec.offset = 0;
              rec.stride = 0;
              rec.divisor = 0;
              rec.state = 1;
            } else if (bufferState.getBuffer(spec.buffer)) {
              rec.buffer = bufferState.getBuffer(spec.buffer);
              rec.size = ((+spec.size) || rec.buffer.dimension) | 0;
              rec.normalized = !!spec.normalized || false;
              if ('type' in spec) {
                check$1.parameter(spec.type, glTypes, 'invalid buffer type');
                rec.type = glTypes[spec.type];
              } else {
                rec.type = rec.buffer.dtype;
              }
              rec.offset = (spec.offset || 0) | 0;
              rec.stride = (spec.stride || 0) | 0;
              rec.divisor = (spec.divisor || 0) | 0;
              rec.state = 1;

              check$1(rec.size >= 1 && rec.size <= 4, 'size must be between 1 and 4');
              check$1(rec.offset >= 0, 'invalid offset');
              check$1(rec.stride >= 0 && rec.stride <= 255, 'stride must be between 0 and 255');
              check$1(rec.divisor >= 0, 'divisor must be positive');
              check$1(!rec.divisor || !!extensions.angle_instanced_arrays, 'ANGLE_instanced_arrays must be enabled to use divisor');
            } else if ('x' in spec) {
              check$1(i > 0, 'first attribute must not be a constant');
              rec.x = +spec.x || 0;
              rec.y = +spec.y || 0;
              rec.z = +spec.z || 0;
              rec.w = +spec.w || 0;
              rec.state = 2;
            } else {
              check$1(false, 'invalid attribute spec for location ' + i);
            }
          }

          // retire unused buffers
          for (var j = 0; j < vao.buffers.length; ++j) {
            if (!bufUpdated[j] && vao.buffers[j]) {
              vao.buffers[j].destroy();
              vao.buffers[j] = null;
            }
          }

          vao.refresh();
          return updateVAO
        }

        updateVAO.destroy = function () {
          for (var j = 0; j < vao.buffers.length; ++j) {
            if (vao.buffers[j]) {
              vao.buffers[j].destroy();
            }
          }
          vao.buffers.length = 0;
          vao.destroy();
        };

        updateVAO._vao = vao;
        updateVAO._reglType = 'vao';

        return updateVAO(_attr)
      }

      return state
    }

    var GL_FRAGMENT_SHADER = 35632;
    var GL_VERTEX_SHADER = 35633;

    var GL_ACTIVE_UNIFORMS = 0x8B86;
    var GL_ACTIVE_ATTRIBUTES = 0x8B89;

    function wrapShaderState (gl, stringStore, stats, config) {
      // ===================================================
      // glsl compilation and linking
      // ===================================================
      var fragShaders = {};
      var vertShaders = {};

      function ActiveInfo (name, id, location, info) {
        this.name = name;
        this.id = id;
        this.location = location;
        this.info = info;
      }

      function insertActiveInfo (list, info) {
        for (var i = 0; i < list.length; ++i) {
          if (list[i].id === info.id) {
            list[i].location = info.location;
            return
          }
        }
        list.push(info);
      }

      function getShader (type, id, command) {
        var cache = type === GL_FRAGMENT_SHADER ? fragShaders : vertShaders;
        var shader = cache[id];

        if (!shader) {
          var source = stringStore.str(id);
          shader = gl.createShader(type);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          check$1.shaderError(gl, shader, source, type, command);
          cache[id] = shader;
        }

        return shader
      }

      // ===================================================
      // program linking
      // ===================================================
      var programCache = {};
      var programList = [];

      var PROGRAM_COUNTER = 0;

      function REGLProgram (fragId, vertId) {
        this.id = PROGRAM_COUNTER++;
        this.fragId = fragId;
        this.vertId = vertId;
        this.program = null;
        this.uniforms = [];
        this.attributes = [];
        this.refCount = 1;

        if (config.profile) {
          this.stats = {
            uniformsCount: 0,
            attributesCount: 0
          };
        }
      }

      function linkProgram (desc, command, attributeLocations) {
        var i, info;

        // -------------------------------
        // compile & link
        // -------------------------------
        var fragShader = getShader(GL_FRAGMENT_SHADER, desc.fragId);
        var vertShader = getShader(GL_VERTEX_SHADER, desc.vertId);

        var program = desc.program = gl.createProgram();
        gl.attachShader(program, fragShader);
        gl.attachShader(program, vertShader);
        if (attributeLocations) {
          for (i = 0; i < attributeLocations.length; ++i) {
            var binding = attributeLocations[i];
            gl.bindAttribLocation(program, binding[0], binding[1]);
          }
        }

        gl.linkProgram(program);
        check$1.linkError(
          gl,
          program,
          stringStore.str(desc.fragId),
          stringStore.str(desc.vertId),
          command);

        // -------------------------------
        // grab uniforms
        // -------------------------------
        var numUniforms = gl.getProgramParameter(program, GL_ACTIVE_UNIFORMS);
        if (config.profile) {
          desc.stats.uniformsCount = numUniforms;
        }
        var uniforms = desc.uniforms;
        for (i = 0; i < numUniforms; ++i) {
          info = gl.getActiveUniform(program, i);
          if (info) {
            if (info.size > 1) {
              for (var j = 0; j < info.size; ++j) {
                var name = info.name.replace('[0]', '[' + j + ']');
                insertActiveInfo(uniforms, new ActiveInfo(
                  name,
                  stringStore.id(name),
                  gl.getUniformLocation(program, name),
                  info));
              }
            } else {
              insertActiveInfo(uniforms, new ActiveInfo(
                info.name,
                stringStore.id(info.name),
                gl.getUniformLocation(program, info.name),
                info));
            }
          }
        }

        // -------------------------------
        // grab attributes
        // -------------------------------
        var numAttributes = gl.getProgramParameter(program, GL_ACTIVE_ATTRIBUTES);
        if (config.profile) {
          desc.stats.attributesCount = numAttributes;
        }

        var attributes = desc.attributes;
        for (i = 0; i < numAttributes; ++i) {
          info = gl.getActiveAttrib(program, i);
          if (info) {
            insertActiveInfo(attributes, new ActiveInfo(
              info.name,
              stringStore.id(info.name),
              gl.getAttribLocation(program, info.name),
              info));
          }
        }
      }

      if (config.profile) {
        stats.getMaxUniformsCount = function () {
          var m = 0;
          programList.forEach(function (desc) {
            if (desc.stats.uniformsCount > m) {
              m = desc.stats.uniformsCount;
            }
          });
          return m
        };

        stats.getMaxAttributesCount = function () {
          var m = 0;
          programList.forEach(function (desc) {
            if (desc.stats.attributesCount > m) {
              m = desc.stats.attributesCount;
            }
          });
          return m
        };
      }

      function restoreShaders () {
        fragShaders = {};
        vertShaders = {};
        for (var i = 0; i < programList.length; ++i) {
          linkProgram(programList[i], null, programList[i].attributes.map(function (info) {
            return [info.location, info.name]
          }));
        }
      }

      return {
        clear: function () {
          var deleteShader = gl.deleteShader.bind(gl);
          values(fragShaders).forEach(deleteShader);
          fragShaders = {};
          values(vertShaders).forEach(deleteShader);
          vertShaders = {};

          programList.forEach(function (desc) {
            gl.deleteProgram(desc.program);
          });
          programList.length = 0;
          programCache = {};

          stats.shaderCount = 0;
        },

        program: function (vertId, fragId, command, attribLocations) {
          check$1.command(vertId >= 0, 'missing vertex shader', command);
          check$1.command(fragId >= 0, 'missing fragment shader', command);

          var cache = programCache[fragId];
          if (!cache) {
            cache = programCache[fragId] = {};
          }
          var prevProgram = cache[vertId];
          if (prevProgram) {
            prevProgram.refCount++;
            if (!attribLocations) {
              return prevProgram
            }
          }
          var program = new REGLProgram(fragId, vertId);
          stats.shaderCount++;
          linkProgram(program, command, attribLocations);
          if (!prevProgram) {
            cache[vertId] = program;
          }
          programList.push(program);
          return extend(program, {
            destroy: function () {
              program.refCount--;
              if (program.refCount <= 0) {
                gl.deleteProgram(program.program);
                var idx = programList.indexOf(program);
                programList.splice(idx, 1);
                stats.shaderCount--;
              }
              // no program is linked to this vert anymore
              if (cache[program.vertId].refCount <= 0) {
                gl.deleteShader(vertShaders[program.vertId]);
                delete vertShaders[program.vertId];
                delete programCache[program.fragId][program.vertId];
              }
              // no program is linked to this frag anymore
              if (!Object.keys(programCache[program.fragId]).length) {
                gl.deleteShader(fragShaders[program.fragId]);
                delete fragShaders[program.fragId];
                delete programCache[program.fragId];
              }
            }
          })
        },

        restore: restoreShaders,

        shader: getShader,

        frag: -1,
        vert: -1
      }
    }

    var GL_RGBA$3 = 6408;
    var GL_UNSIGNED_BYTE$7 = 5121;
    var GL_PACK_ALIGNMENT = 0x0D05;
    var GL_FLOAT$7 = 0x1406; // 5126

    function wrapReadPixels (
      gl,
      framebufferState,
      reglPoll,
      context,
      glAttributes,
      extensions,
      limits) {
      function readPixelsImpl (input) {
        var type;
        if (framebufferState.next === null) {
          check$1(
            glAttributes.preserveDrawingBuffer,
            'you must create a webgl context with "preserveDrawingBuffer":true in order to read pixels from the drawing buffer');
          type = GL_UNSIGNED_BYTE$7;
        } else {
          check$1(
            framebufferState.next.colorAttachments[0].texture !== null,
            'You cannot read from a renderbuffer');
          type = framebufferState.next.colorAttachments[0].texture._texture.type;

          if (extensions.oes_texture_float) {
            check$1(
              type === GL_UNSIGNED_BYTE$7 || type === GL_FLOAT$7,
              'Reading from a framebuffer is only allowed for the types \'uint8\' and \'float\'');

            if (type === GL_FLOAT$7) {
              check$1(limits.readFloat, 'Reading \'float\' values is not permitted in your browser. For a fallback, please see: https://www.npmjs.com/package/glsl-read-float');
            }
          } else {
            check$1(
              type === GL_UNSIGNED_BYTE$7,
              'Reading from a framebuffer is only allowed for the type \'uint8\'');
          }
        }

        var x = 0;
        var y = 0;
        var width = context.framebufferWidth;
        var height = context.framebufferHeight;
        var data = null;

        if (isTypedArray(input)) {
          data = input;
        } else if (input) {
          check$1.type(input, 'object', 'invalid arguments to regl.read()');
          x = input.x | 0;
          y = input.y | 0;
          check$1(
            x >= 0 && x < context.framebufferWidth,
            'invalid x offset for regl.read');
          check$1(
            y >= 0 && y < context.framebufferHeight,
            'invalid y offset for regl.read');
          width = (input.width || (context.framebufferWidth - x)) | 0;
          height = (input.height || (context.framebufferHeight - y)) | 0;
          data = input.data || null;
        }

        // sanity check input.data
        if (data) {
          if (type === GL_UNSIGNED_BYTE$7) {
            check$1(
              data instanceof Uint8Array,
              'buffer must be \'Uint8Array\' when reading from a framebuffer of type \'uint8\'');
          } else if (type === GL_FLOAT$7) {
            check$1(
              data instanceof Float32Array,
              'buffer must be \'Float32Array\' when reading from a framebuffer of type \'float\'');
          }
        }

        check$1(
          width > 0 && width + x <= context.framebufferWidth,
          'invalid width for read pixels');
        check$1(
          height > 0 && height + y <= context.framebufferHeight,
          'invalid height for read pixels');

        // Update WebGL state
        reglPoll();

        // Compute size
        var size = width * height * 4;

        // Allocate data
        if (!data) {
          if (type === GL_UNSIGNED_BYTE$7) {
            data = new Uint8Array(size);
          } else if (type === GL_FLOAT$7) {
            data = data || new Float32Array(size);
          }
        }

        // Type check
        check$1.isTypedArray(data, 'data buffer for regl.read() must be a typedarray');
        check$1(data.byteLength >= size, 'data buffer for regl.read() too small');

        // Run read pixels
        gl.pixelStorei(GL_PACK_ALIGNMENT, 4);
        gl.readPixels(x, y, width, height, GL_RGBA$3,
          type,
          data);

        return data
      }

      function readPixelsFBO (options) {
        var result;
        framebufferState.setFBO({
          framebuffer: options.framebuffer
        }, function () {
          result = readPixelsImpl(options);
        });
        return result
      }

      function readPixels (options) {
        if (!options || !('framebuffer' in options)) {
          return readPixelsImpl(options)
        } else {
          return readPixelsFBO(options)
        }
      }

      return readPixels
    }

    function slice (x) {
      return Array.prototype.slice.call(x)
    }

    function join (x) {
      return slice(x).join('')
    }

    function createEnvironment () {
      // Unique variable id counter
      var varCounter = 0;

      // Linked values are passed from this scope into the generated code block
      // Calling link() passes a value into the generated scope and returns
      // the variable name which it is bound to
      var linkedNames = [];
      var linkedValues = [];
      function link (value) {
        for (var i = 0; i < linkedValues.length; ++i) {
          if (linkedValues[i] === value) {
            return linkedNames[i]
          }
        }

        var name = 'g' + (varCounter++);
        linkedNames.push(name);
        linkedValues.push(value);
        return name
      }

      // create a code block
      function block () {
        var code = [];
        function push () {
          code.push.apply(code, slice(arguments));
        }

        var vars = [];
        function def () {
          var name = 'v' + (varCounter++);
          vars.push(name);

          if (arguments.length > 0) {
            code.push(name, '=');
            code.push.apply(code, slice(arguments));
            code.push(';');
          }

          return name
        }

        return extend(push, {
          def: def,
          toString: function () {
            return join([
              (vars.length > 0 ? 'var ' + vars.join(',') + ';' : ''),
              join(code)
            ])
          }
        })
      }

      function scope () {
        var entry = block();
        var exit = block();

        var entryToString = entry.toString;
        var exitToString = exit.toString;

        function save (object, prop) {
          exit(object, prop, '=', entry.def(object, prop), ';');
        }

        return extend(function () {
          entry.apply(entry, slice(arguments));
        }, {
          def: entry.def,
          entry: entry,
          exit: exit,
          save: save,
          set: function (object, prop, value) {
            save(object, prop);
            entry(object, prop, '=', value, ';');
          },
          toString: function () {
            return entryToString() + exitToString()
          }
        })
      }

      function conditional () {
        var pred = join(arguments);
        var thenBlock = scope();
        var elseBlock = scope();

        var thenToString = thenBlock.toString;
        var elseToString = elseBlock.toString;

        return extend(thenBlock, {
          then: function () {
            thenBlock.apply(thenBlock, slice(arguments));
            return this
          },
          else: function () {
            elseBlock.apply(elseBlock, slice(arguments));
            return this
          },
          toString: function () {
            var elseClause = elseToString();
            if (elseClause) {
              elseClause = 'else{' + elseClause + '}';
            }
            return join([
              'if(', pred, '){',
              thenToString(),
              '}', elseClause
            ])
          }
        })
      }

      // procedure list
      var globalBlock = block();
      var procedures = {};
      function proc (name, count) {
        var args = [];
        function arg () {
          var name = 'a' + args.length;
          args.push(name);
          return name
        }

        count = count || 0;
        for (var i = 0; i < count; ++i) {
          arg();
        }

        var body = scope();
        var bodyToString = body.toString;

        var result = procedures[name] = extend(body, {
          arg: arg,
          toString: function () {
            return join([
              'function(', args.join(), '){',
              bodyToString(),
              '}'
            ])
          }
        });

        return result
      }

      function compile () {
        var code = ['"use strict";',
          globalBlock,
          'return {'];
        Object.keys(procedures).forEach(function (name) {
          code.push('"', name, '":', procedures[name].toString(), ',');
        });
        code.push('}');
        var src = join(code)
          .replace(/;/g, ';\n')
          .replace(/}/g, '}\n')
          .replace(/{/g, '{\n');
        var proc = Function.apply(null, linkedNames.concat(src));
        return proc.apply(null, linkedValues)
      }

      return {
        global: globalBlock,
        link: link,
        block: block,
        proc: proc,
        scope: scope,
        cond: conditional,
        compile: compile
      }
    }

    // "cute" names for vector components
    var CUTE_COMPONENTS = 'xyzw'.split('');

    var GL_UNSIGNED_BYTE$8 = 5121;

    var ATTRIB_STATE_POINTER = 1;
    var ATTRIB_STATE_CONSTANT = 2;

    var DYN_FUNC$1 = 0;
    var DYN_PROP$1 = 1;
    var DYN_CONTEXT$1 = 2;
    var DYN_STATE$1 = 3;
    var DYN_THUNK = 4;
    var DYN_CONSTANT$1 = 5;
    var DYN_ARRAY$1 = 6;

    var S_DITHER = 'dither';
    var S_BLEND_ENABLE = 'blend.enable';
    var S_BLEND_COLOR = 'blend.color';
    var S_BLEND_EQUATION = 'blend.equation';
    var S_BLEND_FUNC = 'blend.func';
    var S_DEPTH_ENABLE = 'depth.enable';
    var S_DEPTH_FUNC = 'depth.func';
    var S_DEPTH_RANGE = 'depth.range';
    var S_DEPTH_MASK = 'depth.mask';
    var S_COLOR_MASK = 'colorMask';
    var S_CULL_ENABLE = 'cull.enable';
    var S_CULL_FACE = 'cull.face';
    var S_FRONT_FACE = 'frontFace';
    var S_LINE_WIDTH = 'lineWidth';
    var S_POLYGON_OFFSET_ENABLE = 'polygonOffset.enable';
    var S_POLYGON_OFFSET_OFFSET = 'polygonOffset.offset';
    var S_SAMPLE_ALPHA = 'sample.alpha';
    var S_SAMPLE_ENABLE = 'sample.enable';
    var S_SAMPLE_COVERAGE = 'sample.coverage';
    var S_STENCIL_ENABLE = 'stencil.enable';
    var S_STENCIL_MASK = 'stencil.mask';
    var S_STENCIL_FUNC = 'stencil.func';
    var S_STENCIL_OPFRONT = 'stencil.opFront';
    var S_STENCIL_OPBACK = 'stencil.opBack';
    var S_SCISSOR_ENABLE = 'scissor.enable';
    var S_SCISSOR_BOX = 'scissor.box';
    var S_VIEWPORT = 'viewport';

    var S_PROFILE = 'profile';

    var S_FRAMEBUFFER = 'framebuffer';
    var S_VERT = 'vert';
    var S_FRAG = 'frag';
    var S_ELEMENTS = 'elements';
    var S_PRIMITIVE = 'primitive';
    var S_COUNT = 'count';
    var S_OFFSET = 'offset';
    var S_INSTANCES = 'instances';
    var S_VAO = 'vao';

    var SUFFIX_WIDTH = 'Width';
    var SUFFIX_HEIGHT = 'Height';

    var S_FRAMEBUFFER_WIDTH = S_FRAMEBUFFER + SUFFIX_WIDTH;
    var S_FRAMEBUFFER_HEIGHT = S_FRAMEBUFFER + SUFFIX_HEIGHT;
    var S_VIEWPORT_WIDTH = S_VIEWPORT + SUFFIX_WIDTH;
    var S_VIEWPORT_HEIGHT = S_VIEWPORT + SUFFIX_HEIGHT;
    var S_DRAWINGBUFFER = 'drawingBuffer';
    var S_DRAWINGBUFFER_WIDTH = S_DRAWINGBUFFER + SUFFIX_WIDTH;
    var S_DRAWINGBUFFER_HEIGHT = S_DRAWINGBUFFER + SUFFIX_HEIGHT;

    var NESTED_OPTIONS = [
      S_BLEND_FUNC,
      S_BLEND_EQUATION,
      S_STENCIL_FUNC,
      S_STENCIL_OPFRONT,
      S_STENCIL_OPBACK,
      S_SAMPLE_COVERAGE,
      S_VIEWPORT,
      S_SCISSOR_BOX,
      S_POLYGON_OFFSET_OFFSET
    ];

    var GL_ARRAY_BUFFER$2 = 34962;
    var GL_ELEMENT_ARRAY_BUFFER$1 = 34963;

    var GL_FRAGMENT_SHADER$1 = 35632;
    var GL_VERTEX_SHADER$1 = 35633;

    var GL_TEXTURE_2D$3 = 0x0DE1;
    var GL_TEXTURE_CUBE_MAP$2 = 0x8513;

    var GL_CULL_FACE = 0x0B44;
    var GL_BLEND = 0x0BE2;
    var GL_DITHER = 0x0BD0;
    var GL_STENCIL_TEST = 0x0B90;
    var GL_DEPTH_TEST = 0x0B71;
    var GL_SCISSOR_TEST = 0x0C11;
    var GL_POLYGON_OFFSET_FILL = 0x8037;
    var GL_SAMPLE_ALPHA_TO_COVERAGE = 0x809E;
    var GL_SAMPLE_COVERAGE = 0x80A0;

    var GL_FLOAT$8 = 5126;
    var GL_FLOAT_VEC2 = 35664;
    var GL_FLOAT_VEC3 = 35665;
    var GL_FLOAT_VEC4 = 35666;
    var GL_INT$3 = 5124;
    var GL_INT_VEC2 = 35667;
    var GL_INT_VEC3 = 35668;
    var GL_INT_VEC4 = 35669;
    var GL_BOOL = 35670;
    var GL_BOOL_VEC2 = 35671;
    var GL_BOOL_VEC3 = 35672;
    var GL_BOOL_VEC4 = 35673;
    var GL_FLOAT_MAT2 = 35674;
    var GL_FLOAT_MAT3 = 35675;
    var GL_FLOAT_MAT4 = 35676;
    var GL_SAMPLER_2D = 35678;
    var GL_SAMPLER_CUBE = 35680;

    var GL_TRIANGLES$1 = 4;

    var GL_FRONT = 1028;
    var GL_BACK = 1029;
    var GL_CW = 0x0900;
    var GL_CCW = 0x0901;
    var GL_MIN_EXT = 0x8007;
    var GL_MAX_EXT = 0x8008;
    var GL_ALWAYS = 519;
    var GL_KEEP = 7680;
    var GL_ZERO = 0;
    var GL_ONE = 1;
    var GL_FUNC_ADD = 0x8006;
    var GL_LESS = 513;

    var GL_FRAMEBUFFER$2 = 0x8D40;
    var GL_COLOR_ATTACHMENT0$2 = 0x8CE0;

    var blendFuncs = {
      '0': 0,
      '1': 1,
      'zero': 0,
      'one': 1,
      'src color': 768,
      'one minus src color': 769,
      'src alpha': 770,
      'one minus src alpha': 771,
      'dst color': 774,
      'one minus dst color': 775,
      'dst alpha': 772,
      'one minus dst alpha': 773,
      'constant color': 32769,
      'one minus constant color': 32770,
      'constant alpha': 32771,
      'one minus constant alpha': 32772,
      'src alpha saturate': 776
    };

    // There are invalid values for srcRGB and dstRGB. See:
    // https://www.khronos.org/registry/webgl/specs/1.0/#6.13
    // https://github.com/KhronosGroup/WebGL/blob/0d3201f5f7ec3c0060bc1f04077461541f1987b9/conformance-suites/1.0.3/conformance/misc/webgl-specific.html#L56
    var invalidBlendCombinations = [
      'constant color, constant alpha',
      'one minus constant color, constant alpha',
      'constant color, one minus constant alpha',
      'one minus constant color, one minus constant alpha',
      'constant alpha, constant color',
      'constant alpha, one minus constant color',
      'one minus constant alpha, constant color',
      'one minus constant alpha, one minus constant color'
    ];

    var compareFuncs = {
      'never': 512,
      'less': 513,
      '<': 513,
      'equal': 514,
      '=': 514,
      '==': 514,
      '===': 514,
      'lequal': 515,
      '<=': 515,
      'greater': 516,
      '>': 516,
      'notequal': 517,
      '!=': 517,
      '!==': 517,
      'gequal': 518,
      '>=': 518,
      'always': 519
    };

    var stencilOps = {
      '0': 0,
      'zero': 0,
      'keep': 7680,
      'replace': 7681,
      'increment': 7682,
      'decrement': 7683,
      'increment wrap': 34055,
      'decrement wrap': 34056,
      'invert': 5386
    };

    var shaderType = {
      'frag': GL_FRAGMENT_SHADER$1,
      'vert': GL_VERTEX_SHADER$1
    };

    var orientationType = {
      'cw': GL_CW,
      'ccw': GL_CCW
    };

    function isBufferArgs (x) {
      return Array.isArray(x) ||
        isTypedArray(x) ||
        isNDArrayLike(x)
    }

    // Make sure viewport is processed first
    function sortState (state) {
      return state.sort(function (a, b) {
        if (a === S_VIEWPORT) {
          return -1
        } else if (b === S_VIEWPORT) {
          return 1
        }
        return (a < b) ? -1 : 1
      })
    }

    function Declaration (thisDep, contextDep, propDep, append) {
      this.thisDep = thisDep;
      this.contextDep = contextDep;
      this.propDep = propDep;
      this.append = append;
    }

    function isStatic (decl) {
      return decl && !(decl.thisDep || decl.contextDep || decl.propDep)
    }

    function createStaticDecl (append) {
      return new Declaration(false, false, false, append)
    }

    function createDynamicDecl (dyn, append) {
      var type = dyn.type;
      if (type === DYN_FUNC$1) {
        var numArgs = dyn.data.length;
        return new Declaration(
          true,
          numArgs >= 1,
          numArgs >= 2,
          append)
      } else if (type === DYN_THUNK) {
        var data = dyn.data;
        return new Declaration(
          data.thisDep,
          data.contextDep,
          data.propDep,
          append)
      } else if (type === DYN_CONSTANT$1) {
        return new Declaration(
          false,
          false,
          false,
          append)
      } else if (type === DYN_ARRAY$1) {
        var thisDep = false;
        var contextDep = false;
        var propDep = false;
        for (var i = 0; i < dyn.data.length; ++i) {
          var subDyn = dyn.data[i];
          if (subDyn.type === DYN_PROP$1) {
            propDep = true;
          } else if (subDyn.type === DYN_CONTEXT$1) {
            contextDep = true;
          } else if (subDyn.type === DYN_STATE$1) {
            thisDep = true;
          } else if (subDyn.type === DYN_FUNC$1) {
            thisDep = true;
            var subArgs = subDyn.data;
            if (subArgs >= 1) {
              contextDep = true;
            }
            if (subArgs >= 2) {
              propDep = true;
            }
          } else if (subDyn.type === DYN_THUNK) {
            thisDep = thisDep || subDyn.data.thisDep;
            contextDep = contextDep || subDyn.data.contextDep;
            propDep = propDep || subDyn.data.propDep;
          }
        }
        return new Declaration(
          thisDep,
          contextDep,
          propDep,
          append)
      } else {
        return new Declaration(
          type === DYN_STATE$1,
          type === DYN_CONTEXT$1,
          type === DYN_PROP$1,
          append)
      }
    }

    var SCOPE_DECL = new Declaration(false, false, false, function () {});

    function reglCore (
      gl,
      stringStore,
      extensions,
      limits,
      bufferState,
      elementState,
      textureState,
      framebufferState,
      uniformState,
      attributeState,
      shaderState,
      drawState,
      contextState,
      timer,
      config) {
      var AttributeRecord = attributeState.Record;

      var blendEquations = {
        'add': 32774,
        'subtract': 32778,
        'reverse subtract': 32779
      };
      if (extensions.ext_blend_minmax) {
        blendEquations.min = GL_MIN_EXT;
        blendEquations.max = GL_MAX_EXT;
      }

      var extInstancing = extensions.angle_instanced_arrays;
      var extDrawBuffers = extensions.webgl_draw_buffers;

      // ===================================================
      // ===================================================
      // WEBGL STATE
      // ===================================================
      // ===================================================
      var currentState = {
        dirty: true,
        profile: config.profile
      };
      var nextState = {};
      var GL_STATE_NAMES = [];
      var GL_FLAGS = {};
      var GL_VARIABLES = {};

      function propName (name) {
        return name.replace('.', '_')
      }

      function stateFlag (sname, cap, init) {
        var name = propName(sname);
        GL_STATE_NAMES.push(sname);
        nextState[name] = currentState[name] = !!init;
        GL_FLAGS[name] = cap;
      }

      function stateVariable (sname, func, init) {
        var name = propName(sname);
        GL_STATE_NAMES.push(sname);
        if (Array.isArray(init)) {
          currentState[name] = init.slice();
          nextState[name] = init.slice();
        } else {
          currentState[name] = nextState[name] = init;
        }
        GL_VARIABLES[name] = func;
      }

      // Dithering
      stateFlag(S_DITHER, GL_DITHER);

      // Blending
      stateFlag(S_BLEND_ENABLE, GL_BLEND);
      stateVariable(S_BLEND_COLOR, 'blendColor', [0, 0, 0, 0]);
      stateVariable(S_BLEND_EQUATION, 'blendEquationSeparate',
        [GL_FUNC_ADD, GL_FUNC_ADD]);
      stateVariable(S_BLEND_FUNC, 'blendFuncSeparate',
        [GL_ONE, GL_ZERO, GL_ONE, GL_ZERO]);

      // Depth
      stateFlag(S_DEPTH_ENABLE, GL_DEPTH_TEST, true);
      stateVariable(S_DEPTH_FUNC, 'depthFunc', GL_LESS);
      stateVariable(S_DEPTH_RANGE, 'depthRange', [0, 1]);
      stateVariable(S_DEPTH_MASK, 'depthMask', true);

      // Color mask
      stateVariable(S_COLOR_MASK, S_COLOR_MASK, [true, true, true, true]);

      // Face culling
      stateFlag(S_CULL_ENABLE, GL_CULL_FACE);
      stateVariable(S_CULL_FACE, 'cullFace', GL_BACK);

      // Front face orientation
      stateVariable(S_FRONT_FACE, S_FRONT_FACE, GL_CCW);

      // Line width
      stateVariable(S_LINE_WIDTH, S_LINE_WIDTH, 1);

      // Polygon offset
      stateFlag(S_POLYGON_OFFSET_ENABLE, GL_POLYGON_OFFSET_FILL);
      stateVariable(S_POLYGON_OFFSET_OFFSET, 'polygonOffset', [0, 0]);

      // Sample coverage
      stateFlag(S_SAMPLE_ALPHA, GL_SAMPLE_ALPHA_TO_COVERAGE);
      stateFlag(S_SAMPLE_ENABLE, GL_SAMPLE_COVERAGE);
      stateVariable(S_SAMPLE_COVERAGE, 'sampleCoverage', [1, false]);

      // Stencil
      stateFlag(S_STENCIL_ENABLE, GL_STENCIL_TEST);
      stateVariable(S_STENCIL_MASK, 'stencilMask', -1);
      stateVariable(S_STENCIL_FUNC, 'stencilFunc', [GL_ALWAYS, 0, -1]);
      stateVariable(S_STENCIL_OPFRONT, 'stencilOpSeparate',
        [GL_FRONT, GL_KEEP, GL_KEEP, GL_KEEP]);
      stateVariable(S_STENCIL_OPBACK, 'stencilOpSeparate',
        [GL_BACK, GL_KEEP, GL_KEEP, GL_KEEP]);

      // Scissor
      stateFlag(S_SCISSOR_ENABLE, GL_SCISSOR_TEST);
      stateVariable(S_SCISSOR_BOX, 'scissor',
        [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);

      // Viewport
      stateVariable(S_VIEWPORT, S_VIEWPORT,
        [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]);

      // ===================================================
      // ===================================================
      // ENVIRONMENT
      // ===================================================
      // ===================================================
      var sharedState = {
        gl: gl,
        context: contextState,
        strings: stringStore,
        next: nextState,
        current: currentState,
        draw: drawState,
        elements: elementState,
        buffer: bufferState,
        shader: shaderState,
        attributes: attributeState.state,
        vao: attributeState,
        uniforms: uniformState,
        framebuffer: framebufferState,
        extensions: extensions,

        timer: timer,
        isBufferArgs: isBufferArgs
      };

      var sharedConstants = {
        primTypes: primTypes,
        compareFuncs: compareFuncs,
        blendFuncs: blendFuncs,
        blendEquations: blendEquations,
        stencilOps: stencilOps,
        glTypes: glTypes,
        orientationType: orientationType
      };

      check$1.optional(function () {
        sharedState.isArrayLike = isArrayLike;
      });

      if (extDrawBuffers) {
        sharedConstants.backBuffer = [GL_BACK];
        sharedConstants.drawBuffer = loop(limits.maxDrawbuffers, function (i) {
          if (i === 0) {
            return [0]
          }
          return loop(i, function (j) {
            return GL_COLOR_ATTACHMENT0$2 + j
          })
        });
      }

      var drawCallCounter = 0;
      function createREGLEnvironment () {
        var env = createEnvironment();
        var link = env.link;
        var global = env.global;
        env.id = drawCallCounter++;

        env.batchId = '0';

        // link shared state
        var SHARED = link(sharedState);
        var shared = env.shared = {
          props: 'a0'
        };
        Object.keys(sharedState).forEach(function (prop) {
          shared[prop] = global.def(SHARED, '.', prop);
        });

        // Inject runtime assertion stuff for debug builds
        check$1.optional(function () {
          env.CHECK = link(check$1);
          env.commandStr = check$1.guessCommand();
          env.command = link(env.commandStr);
          env.assert = function (block, pred, message) {
            block(
              'if(!(', pred, '))',
              this.CHECK, '.commandRaise(', link(message), ',', this.command, ');');
          };

          sharedConstants.invalidBlendCombinations = invalidBlendCombinations;
        });

        // Copy GL state variables over
        var nextVars = env.next = {};
        var currentVars = env.current = {};
        Object.keys(GL_VARIABLES).forEach(function (variable) {
          if (Array.isArray(currentState[variable])) {
            nextVars[variable] = global.def(shared.next, '.', variable);
            currentVars[variable] = global.def(shared.current, '.', variable);
          }
        });

        // Initialize shared constants
        var constants = env.constants = {};
        Object.keys(sharedConstants).forEach(function (name) {
          constants[name] = global.def(JSON.stringify(sharedConstants[name]));
        });

        // Helper function for calling a block
        env.invoke = function (block, x) {
          switch (x.type) {
            case DYN_FUNC$1:
              var argList = [
                'this',
                shared.context,
                shared.props,
                env.batchId
              ];
              return block.def(
                link(x.data), '.call(',
                argList.slice(0, Math.max(x.data.length + 1, 4)),
                ')')
            case DYN_PROP$1:
              return block.def(shared.props, x.data)
            case DYN_CONTEXT$1:
              return block.def(shared.context, x.data)
            case DYN_STATE$1:
              return block.def('this', x.data)
            case DYN_THUNK:
              x.data.append(env, block);
              return x.data.ref
            case DYN_CONSTANT$1:
              return x.data.toString()
            case DYN_ARRAY$1:
              return x.data.map(function (y) {
                return env.invoke(block, y)
              })
          }
        };

        env.attribCache = {};

        var scopeAttribs = {};
        env.scopeAttrib = function (name) {
          var id = stringStore.id(name);
          if (id in scopeAttribs) {
            return scopeAttribs[id]
          }
          var binding = attributeState.scope[id];
          if (!binding) {
            binding = attributeState.scope[id] = new AttributeRecord();
          }
          var result = scopeAttribs[id] = link(binding);
          return result
        };

        return env
      }

      // ===================================================
      // ===================================================
      // PARSING
      // ===================================================
      // ===================================================
      function parseProfile (options) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        var profileEnable;
        if (S_PROFILE in staticOptions) {
          var value = !!staticOptions[S_PROFILE];
          profileEnable = createStaticDecl(function (env, scope) {
            return value
          });
          profileEnable.enable = value;
        } else if (S_PROFILE in dynamicOptions) {
          var dyn = dynamicOptions[S_PROFILE];
          profileEnable = createDynamicDecl(dyn, function (env, scope) {
            return env.invoke(scope, dyn)
          });
        }

        return profileEnable
      }

      function parseFramebuffer (options, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        if (S_FRAMEBUFFER in staticOptions) {
          var framebuffer = staticOptions[S_FRAMEBUFFER];
          if (framebuffer) {
            framebuffer = framebufferState.getFramebuffer(framebuffer);
            check$1.command(framebuffer, 'invalid framebuffer object');
            return createStaticDecl(function (env, block) {
              var FRAMEBUFFER = env.link(framebuffer);
              var shared = env.shared;
              block.set(
                shared.framebuffer,
                '.next',
                FRAMEBUFFER);
              var CONTEXT = shared.context;
              block.set(
                CONTEXT,
                '.' + S_FRAMEBUFFER_WIDTH,
                FRAMEBUFFER + '.width');
              block.set(
                CONTEXT,
                '.' + S_FRAMEBUFFER_HEIGHT,
                FRAMEBUFFER + '.height');
              return FRAMEBUFFER
            })
          } else {
            return createStaticDecl(function (env, scope) {
              var shared = env.shared;
              scope.set(
                shared.framebuffer,
                '.next',
                'null');
              var CONTEXT = shared.context;
              scope.set(
                CONTEXT,
                '.' + S_FRAMEBUFFER_WIDTH,
                CONTEXT + '.' + S_DRAWINGBUFFER_WIDTH);
              scope.set(
                CONTEXT,
                '.' + S_FRAMEBUFFER_HEIGHT,
                CONTEXT + '.' + S_DRAWINGBUFFER_HEIGHT);
              return 'null'
            })
          }
        } else if (S_FRAMEBUFFER in dynamicOptions) {
          var dyn = dynamicOptions[S_FRAMEBUFFER];
          return createDynamicDecl(dyn, function (env, scope) {
            var FRAMEBUFFER_FUNC = env.invoke(scope, dyn);
            var shared = env.shared;
            var FRAMEBUFFER_STATE = shared.framebuffer;
            var FRAMEBUFFER = scope.def(
              FRAMEBUFFER_STATE, '.getFramebuffer(', FRAMEBUFFER_FUNC, ')');

            check$1.optional(function () {
              env.assert(scope,
                '!' + FRAMEBUFFER_FUNC + '||' + FRAMEBUFFER,
                'invalid framebuffer object');
            });

            scope.set(
              FRAMEBUFFER_STATE,
              '.next',
              FRAMEBUFFER);
            var CONTEXT = shared.context;
            scope.set(
              CONTEXT,
              '.' + S_FRAMEBUFFER_WIDTH,
              FRAMEBUFFER + '?' + FRAMEBUFFER + '.width:' +
              CONTEXT + '.' + S_DRAWINGBUFFER_WIDTH);
            scope.set(
              CONTEXT,
              '.' + S_FRAMEBUFFER_HEIGHT,
              FRAMEBUFFER +
              '?' + FRAMEBUFFER + '.height:' +
              CONTEXT + '.' + S_DRAWINGBUFFER_HEIGHT);
            return FRAMEBUFFER
          })
        } else {
          return null
        }
      }

      function parseViewportScissor (options, framebuffer, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        function parseBox (param) {
          if (param in staticOptions) {
            var box = staticOptions[param];
            check$1.commandType(box, 'object', 'invalid ' + param, env.commandStr);

            var isStatic = true;
            var x = box.x | 0;
            var y = box.y | 0;
            var w, h;
            if ('width' in box) {
              w = box.width | 0;
              check$1.command(w >= 0, 'invalid ' + param, env.commandStr);
            } else {
              isStatic = false;
            }
            if ('height' in box) {
              h = box.height | 0;
              check$1.command(h >= 0, 'invalid ' + param, env.commandStr);
            } else {
              isStatic = false;
            }

            return new Declaration(
              !isStatic && framebuffer && framebuffer.thisDep,
              !isStatic && framebuffer && framebuffer.contextDep,
              !isStatic && framebuffer && framebuffer.propDep,
              function (env, scope) {
                var CONTEXT = env.shared.context;
                var BOX_W = w;
                if (!('width' in box)) {
                  BOX_W = scope.def(CONTEXT, '.', S_FRAMEBUFFER_WIDTH, '-', x);
                }
                var BOX_H = h;
                if (!('height' in box)) {
                  BOX_H = scope.def(CONTEXT, '.', S_FRAMEBUFFER_HEIGHT, '-', y);
                }
                return [x, y, BOX_W, BOX_H]
              })
          } else if (param in dynamicOptions) {
            var dynBox = dynamicOptions[param];
            var result = createDynamicDecl(dynBox, function (env, scope) {
              var BOX = env.invoke(scope, dynBox);

              check$1.optional(function () {
                env.assert(scope,
                  BOX + '&&typeof ' + BOX + '==="object"',
                  'invalid ' + param);
              });

              var CONTEXT = env.shared.context;
              var BOX_X = scope.def(BOX, '.x|0');
              var BOX_Y = scope.def(BOX, '.y|0');
              var BOX_W = scope.def(
                '"width" in ', BOX, '?', BOX, '.width|0:',
                '(', CONTEXT, '.', S_FRAMEBUFFER_WIDTH, '-', BOX_X, ')');
              var BOX_H = scope.def(
                '"height" in ', BOX, '?', BOX, '.height|0:',
                '(', CONTEXT, '.', S_FRAMEBUFFER_HEIGHT, '-', BOX_Y, ')');

              check$1.optional(function () {
                env.assert(scope,
                  BOX_W + '>=0&&' +
                  BOX_H + '>=0',
                  'invalid ' + param);
              });

              return [BOX_X, BOX_Y, BOX_W, BOX_H]
            });
            if (framebuffer) {
              result.thisDep = result.thisDep || framebuffer.thisDep;
              result.contextDep = result.contextDep || framebuffer.contextDep;
              result.propDep = result.propDep || framebuffer.propDep;
            }
            return result
          } else if (framebuffer) {
            return new Declaration(
              framebuffer.thisDep,
              framebuffer.contextDep,
              framebuffer.propDep,
              function (env, scope) {
                var CONTEXT = env.shared.context;
                return [
                  0, 0,
                  scope.def(CONTEXT, '.', S_FRAMEBUFFER_WIDTH),
                  scope.def(CONTEXT, '.', S_FRAMEBUFFER_HEIGHT)]
              })
          } else {
            return null
          }
        }

        var viewport = parseBox(S_VIEWPORT);

        if (viewport) {
          var prevViewport = viewport;
          viewport = new Declaration(
            viewport.thisDep,
            viewport.contextDep,
            viewport.propDep,
            function (env, scope) {
              var VIEWPORT = prevViewport.append(env, scope);
              var CONTEXT = env.shared.context;
              scope.set(
                CONTEXT,
                '.' + S_VIEWPORT_WIDTH,
                VIEWPORT[2]);
              scope.set(
                CONTEXT,
                '.' + S_VIEWPORT_HEIGHT,
                VIEWPORT[3]);
              return VIEWPORT
            });
        }

        return {
          viewport: viewport,
          scissor_box: parseBox(S_SCISSOR_BOX)
        }
      }

      function parseAttribLocations (options, attributes) {
        var staticOptions = options.static;
        var staticProgram =
          typeof staticOptions[S_FRAG] === 'string' &&
          typeof staticOptions[S_VERT] === 'string';
        if (staticProgram) {
          if (Object.keys(attributes.dynamic).length > 0) {
            return null
          }
          var staticAttributes = attributes.static;
          var sAttributes = Object.keys(staticAttributes);
          if (sAttributes.length > 0 && typeof staticAttributes[sAttributes[0]] === 'number') {
            var bindings = [];
            for (var i = 0; i < sAttributes.length; ++i) {
              check$1(typeof staticAttributes[sAttributes[i]] === 'number', 'must specify all vertex attribute locations when using vaos');
              bindings.push([staticAttributes[sAttributes[i]] | 0, sAttributes[i]]);
            }
            return bindings
          }
        }
        return null
      }

      function parseProgram (options, env, attribLocations) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        function parseShader (name) {
          if (name in staticOptions) {
            var id = stringStore.id(staticOptions[name]);
            check$1.optional(function () {
              shaderState.shader(shaderType[name], id, check$1.guessCommand());
            });
            var result = createStaticDecl(function () {
              return id
            });
            result.id = id;
            return result
          } else if (name in dynamicOptions) {
            var dyn = dynamicOptions[name];
            return createDynamicDecl(dyn, function (env, scope) {
              var str = env.invoke(scope, dyn);
              var id = scope.def(env.shared.strings, '.id(', str, ')');
              check$1.optional(function () {
                scope(
                  env.shared.shader, '.shader(',
                  shaderType[name], ',',
                  id, ',',
                  env.command, ');');
              });
              return id
            })
          }
          return null
        }

        var frag = parseShader(S_FRAG);
        var vert = parseShader(S_VERT);

        var program = null;
        var progVar;
        if (isStatic(frag) && isStatic(vert)) {
          program = shaderState.program(vert.id, frag.id, null, attribLocations);
          progVar = createStaticDecl(function (env, scope) {
            return env.link(program)
          });
        } else {
          progVar = new Declaration(
            (frag && frag.thisDep) || (vert && vert.thisDep),
            (frag && frag.contextDep) || (vert && vert.contextDep),
            (frag && frag.propDep) || (vert && vert.propDep),
            function (env, scope) {
              var SHADER_STATE = env.shared.shader;
              var fragId;
              if (frag) {
                fragId = frag.append(env, scope);
              } else {
                fragId = scope.def(SHADER_STATE, '.', S_FRAG);
              }
              var vertId;
              if (vert) {
                vertId = vert.append(env, scope);
              } else {
                vertId = scope.def(SHADER_STATE, '.', S_VERT);
              }
              var progDef = SHADER_STATE + '.program(' + vertId + ',' + fragId;
              check$1.optional(function () {
                progDef += ',' + env.command;
              });
              return scope.def(progDef + ')')
            });
        }

        return {
          frag: frag,
          vert: vert,
          progVar: progVar,
          program: program
        }
      }

      function parseDraw (options, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        function parseElements () {
          if (S_ELEMENTS in staticOptions) {
            var elements = staticOptions[S_ELEMENTS];
            if (isBufferArgs(elements)) {
              elements = elementState.getElements(elementState.create(elements, true));
            } else if (elements) {
              elements = elementState.getElements(elements);
              check$1.command(elements, 'invalid elements', env.commandStr);
            }
            var result = createStaticDecl(function (env, scope) {
              if (elements) {
                var result = env.link(elements);
                env.ELEMENTS = result;
                return result
              }
              env.ELEMENTS = null;
              return null
            });
            result.value = elements;
            return result
          } else if (S_ELEMENTS in dynamicOptions) {
            var dyn = dynamicOptions[S_ELEMENTS];
            return createDynamicDecl(dyn, function (env, scope) {
              var shared = env.shared;

              var IS_BUFFER_ARGS = shared.isBufferArgs;
              var ELEMENT_STATE = shared.elements;

              var elementDefn = env.invoke(scope, dyn);
              var elements = scope.def('null');
              var elementStream = scope.def(IS_BUFFER_ARGS, '(', elementDefn, ')');

              var ifte = env.cond(elementStream)
                .then(elements, '=', ELEMENT_STATE, '.createStream(', elementDefn, ');')
                .else(elements, '=', ELEMENT_STATE, '.getElements(', elementDefn, ');');

              check$1.optional(function () {
                env.assert(ifte.else,
                  '!' + elementDefn + '||' + elements,
                  'invalid elements');
              });

              scope.entry(ifte);
              scope.exit(
                env.cond(elementStream)
                  .then(ELEMENT_STATE, '.destroyStream(', elements, ');'));

              env.ELEMENTS = elements;

              return elements
            })
          }

          return null
        }

        var elements = parseElements();

        function parsePrimitive () {
          if (S_PRIMITIVE in staticOptions) {
            var primitive = staticOptions[S_PRIMITIVE];
            check$1.commandParameter(primitive, primTypes, 'invalid primitve', env.commandStr);
            return createStaticDecl(function (env, scope) {
              return primTypes[primitive]
            })
          } else if (S_PRIMITIVE in dynamicOptions) {
            var dynPrimitive = dynamicOptions[S_PRIMITIVE];
            return createDynamicDecl(dynPrimitive, function (env, scope) {
              var PRIM_TYPES = env.constants.primTypes;
              var prim = env.invoke(scope, dynPrimitive);
              check$1.optional(function () {
                env.assert(scope,
                  prim + ' in ' + PRIM_TYPES,
                  'invalid primitive, must be one of ' + Object.keys(primTypes));
              });
              return scope.def(PRIM_TYPES, '[', prim, ']')
            })
          } else if (elements) {
            if (isStatic(elements)) {
              if (elements.value) {
                return createStaticDecl(function (env, scope) {
                  return scope.def(env.ELEMENTS, '.primType')
                })
              } else {
                return createStaticDecl(function () {
                  return GL_TRIANGLES$1
                })
              }
            } else {
              return new Declaration(
                elements.thisDep,
                elements.contextDep,
                elements.propDep,
                function (env, scope) {
                  var elements = env.ELEMENTS;
                  return scope.def(elements, '?', elements, '.primType:', GL_TRIANGLES$1)
                })
            }
          }
          return null
        }

        function parseParam (param, isOffset) {
          if (param in staticOptions) {
            var value = staticOptions[param] | 0;
            check$1.command(!isOffset || value >= 0, 'invalid ' + param, env.commandStr);
            return createStaticDecl(function (env, scope) {
              if (isOffset) {
                env.OFFSET = value;
              }
              return value
            })
          } else if (param in dynamicOptions) {
            var dynValue = dynamicOptions[param];
            return createDynamicDecl(dynValue, function (env, scope) {
              var result = env.invoke(scope, dynValue);
              if (isOffset) {
                env.OFFSET = result;
                check$1.optional(function () {
                  env.assert(scope,
                    result + '>=0',
                    'invalid ' + param);
                });
              }
              return result
            })
          } else if (isOffset && elements) {
            return createStaticDecl(function (env, scope) {
              env.OFFSET = '0';
              return 0
            })
          }
          return null
        }

        var OFFSET = parseParam(S_OFFSET, true);

        function parseVertCount () {
          if (S_COUNT in staticOptions) {
            var count = staticOptions[S_COUNT] | 0;
            check$1.command(
              typeof count === 'number' && count >= 0, 'invalid vertex count', env.commandStr);
            return createStaticDecl(function () {
              return count
            })
          } else if (S_COUNT in dynamicOptions) {
            var dynCount = dynamicOptions[S_COUNT];
            return createDynamicDecl(dynCount, function (env, scope) {
              var result = env.invoke(scope, dynCount);
              check$1.optional(function () {
                env.assert(scope,
                  'typeof ' + result + '==="number"&&' +
                  result + '>=0&&' +
                  result + '===(' + result + '|0)',
                  'invalid vertex count');
              });
              return result
            })
          } else if (elements) {
            if (isStatic(elements)) {
              if (elements) {
                if (OFFSET) {
                  return new Declaration(
                    OFFSET.thisDep,
                    OFFSET.contextDep,
                    OFFSET.propDep,
                    function (env, scope) {
                      var result = scope.def(
                        env.ELEMENTS, '.vertCount-', env.OFFSET);

                      check$1.optional(function () {
                        env.assert(scope,
                          result + '>=0',
                          'invalid vertex offset/element buffer too small');
                      });

                      return result
                    })
                } else {
                  return createStaticDecl(function (env, scope) {
                    return scope.def(env.ELEMENTS, '.vertCount')
                  })
                }
              } else {
                var result = createStaticDecl(function () {
                  return -1
                });
                check$1.optional(function () {
                  result.MISSING = true;
                });
                return result
              }
            } else {
              var variable = new Declaration(
                elements.thisDep || OFFSET.thisDep,
                elements.contextDep || OFFSET.contextDep,
                elements.propDep || OFFSET.propDep,
                function (env, scope) {
                  var elements = env.ELEMENTS;
                  if (env.OFFSET) {
                    return scope.def(elements, '?', elements, '.vertCount-',
                      env.OFFSET, ':-1')
                  }
                  return scope.def(elements, '?', elements, '.vertCount:-1')
                });
              check$1.optional(function () {
                variable.DYNAMIC = true;
              });
              return variable
            }
          }
          return null
        }

        return {
          elements: elements,
          primitive: parsePrimitive(),
          count: parseVertCount(),
          instances: parseParam(S_INSTANCES, false),
          offset: OFFSET
        }
      }

      function parseGLState (options, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        var STATE = {};

        GL_STATE_NAMES.forEach(function (prop) {
          var param = propName(prop);

          function parseParam (parseStatic, parseDynamic) {
            if (prop in staticOptions) {
              var value = parseStatic(staticOptions[prop]);
              STATE[param] = createStaticDecl(function () {
                return value
              });
            } else if (prop in dynamicOptions) {
              var dyn = dynamicOptions[prop];
              STATE[param] = createDynamicDecl(dyn, function (env, scope) {
                return parseDynamic(env, scope, env.invoke(scope, dyn))
              });
            }
          }

          switch (prop) {
            case S_CULL_ENABLE:
            case S_BLEND_ENABLE:
            case S_DITHER:
            case S_STENCIL_ENABLE:
            case S_DEPTH_ENABLE:
            case S_SCISSOR_ENABLE:
            case S_POLYGON_OFFSET_ENABLE:
            case S_SAMPLE_ALPHA:
            case S_SAMPLE_ENABLE:
            case S_DEPTH_MASK:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'boolean', prop, env.commandStr);
                  return value
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      'typeof ' + value + '==="boolean"',
                      'invalid flag ' + prop, env.commandStr);
                  });
                  return value
                })

            case S_DEPTH_FUNC:
              return parseParam(
                function (value) {
                  check$1.commandParameter(value, compareFuncs, 'invalid ' + prop, env.commandStr);
                  return compareFuncs[value]
                },
                function (env, scope, value) {
                  var COMPARE_FUNCS = env.constants.compareFuncs;
                  check$1.optional(function () {
                    env.assert(scope,
                      value + ' in ' + COMPARE_FUNCS,
                      'invalid ' + prop + ', must be one of ' + Object.keys(compareFuncs));
                  });
                  return scope.def(COMPARE_FUNCS, '[', value, ']')
                })

            case S_DEPTH_RANGE:
              return parseParam(
                function (value) {
                  check$1.command(
                    isArrayLike(value) &&
                    value.length === 2 &&
                    typeof value[0] === 'number' &&
                    typeof value[1] === 'number' &&
                    value[0] <= value[1],
                    'depth range is 2d array',
                    env.commandStr);
                  return value
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      env.shared.isArrayLike + '(' + value + ')&&' +
                      value + '.length===2&&' +
                      'typeof ' + value + '[0]==="number"&&' +
                      'typeof ' + value + '[1]==="number"&&' +
                      value + '[0]<=' + value + '[1]',
                      'depth range must be a 2d array');
                  });

                  var Z_NEAR = scope.def('+', value, '[0]');
                  var Z_FAR = scope.def('+', value, '[1]');
                  return [Z_NEAR, Z_FAR]
                })

            case S_BLEND_FUNC:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'object', 'blend.func', env.commandStr);
                  var srcRGB = ('srcRGB' in value ? value.srcRGB : value.src);
                  var srcAlpha = ('srcAlpha' in value ? value.srcAlpha : value.src);
                  var dstRGB = ('dstRGB' in value ? value.dstRGB : value.dst);
                  var dstAlpha = ('dstAlpha' in value ? value.dstAlpha : value.dst);
                  check$1.commandParameter(srcRGB, blendFuncs, param + '.srcRGB', env.commandStr);
                  check$1.commandParameter(srcAlpha, blendFuncs, param + '.srcAlpha', env.commandStr);
                  check$1.commandParameter(dstRGB, blendFuncs, param + '.dstRGB', env.commandStr);
                  check$1.commandParameter(dstAlpha, blendFuncs, param + '.dstAlpha', env.commandStr);

                  check$1.command(
                    (invalidBlendCombinations.indexOf(srcRGB + ', ' + dstRGB) === -1),
                    'unallowed blending combination (srcRGB, dstRGB) = (' + srcRGB + ', ' + dstRGB + ')', env.commandStr);

                  return [
                    blendFuncs[srcRGB],
                    blendFuncs[dstRGB],
                    blendFuncs[srcAlpha],
                    blendFuncs[dstAlpha]
                  ]
                },
                function (env, scope, value) {
                  var BLEND_FUNCS = env.constants.blendFuncs;

                  check$1.optional(function () {
                    env.assert(scope,
                      value + '&&typeof ' + value + '==="object"',
                      'invalid blend func, must be an object');
                  });

                  function read (prefix, suffix) {
                    var func = scope.def(
                      '"', prefix, suffix, '" in ', value,
                      '?', value, '.', prefix, suffix,
                      ':', value, '.', prefix);

                    check$1.optional(function () {
                      env.assert(scope,
                        func + ' in ' + BLEND_FUNCS,
                        'invalid ' + prop + '.' + prefix + suffix + ', must be one of ' + Object.keys(blendFuncs));
                    });

                    return func
                  }

                  var srcRGB = read('src', 'RGB');
                  var dstRGB = read('dst', 'RGB');

                  check$1.optional(function () {
                    var INVALID_BLEND_COMBINATIONS = env.constants.invalidBlendCombinations;

                    env.assert(scope,
                      INVALID_BLEND_COMBINATIONS +
                               '.indexOf(' + srcRGB + '+", "+' + dstRGB + ') === -1 ',
                      'unallowed blending combination for (srcRGB, dstRGB)'
                    );
                  });

                  var SRC_RGB = scope.def(BLEND_FUNCS, '[', srcRGB, ']');
                  var SRC_ALPHA = scope.def(BLEND_FUNCS, '[', read('src', 'Alpha'), ']');
                  var DST_RGB = scope.def(BLEND_FUNCS, '[', dstRGB, ']');
                  var DST_ALPHA = scope.def(BLEND_FUNCS, '[', read('dst', 'Alpha'), ']');

                  return [SRC_RGB, DST_RGB, SRC_ALPHA, DST_ALPHA]
                })

            case S_BLEND_EQUATION:
              return parseParam(
                function (value) {
                  if (typeof value === 'string') {
                    check$1.commandParameter(value, blendEquations, 'invalid ' + prop, env.commandStr);
                    return [
                      blendEquations[value],
                      blendEquations[value]
                    ]
                  } else if (typeof value === 'object') {
                    check$1.commandParameter(
                      value.rgb, blendEquations, prop + '.rgb', env.commandStr);
                    check$1.commandParameter(
                      value.alpha, blendEquations, prop + '.alpha', env.commandStr);
                    return [
                      blendEquations[value.rgb],
                      blendEquations[value.alpha]
                    ]
                  } else {
                    check$1.commandRaise('invalid blend.equation', env.commandStr);
                  }
                },
                function (env, scope, value) {
                  var BLEND_EQUATIONS = env.constants.blendEquations;

                  var RGB = scope.def();
                  var ALPHA = scope.def();

                  var ifte = env.cond('typeof ', value, '==="string"');

                  check$1.optional(function () {
                    function checkProp (block, name, value) {
                      env.assert(block,
                        value + ' in ' + BLEND_EQUATIONS,
                        'invalid ' + name + ', must be one of ' + Object.keys(blendEquations));
                    }
                    checkProp(ifte.then, prop, value);

                    env.assert(ifte.else,
                      value + '&&typeof ' + value + '==="object"',
                      'invalid ' + prop);
                    checkProp(ifte.else, prop + '.rgb', value + '.rgb');
                    checkProp(ifte.else, prop + '.alpha', value + '.alpha');
                  });

                  ifte.then(
                    RGB, '=', ALPHA, '=', BLEND_EQUATIONS, '[', value, '];');
                  ifte.else(
                    RGB, '=', BLEND_EQUATIONS, '[', value, '.rgb];',
                    ALPHA, '=', BLEND_EQUATIONS, '[', value, '.alpha];');

                  scope(ifte);

                  return [RGB, ALPHA]
                })

            case S_BLEND_COLOR:
              return parseParam(
                function (value) {
                  check$1.command(
                    isArrayLike(value) &&
                    value.length === 4,
                    'blend.color must be a 4d array', env.commandStr);
                  return loop(4, function (i) {
                    return +value[i]
                  })
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      env.shared.isArrayLike + '(' + value + ')&&' +
                      value + '.length===4',
                      'blend.color must be a 4d array');
                  });
                  return loop(4, function (i) {
                    return scope.def('+', value, '[', i, ']')
                  })
                })

            case S_STENCIL_MASK:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'number', param, env.commandStr);
                  return value | 0
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      'typeof ' + value + '==="number"',
                      'invalid stencil.mask');
                  });
                  return scope.def(value, '|0')
                })

            case S_STENCIL_FUNC:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'object', param, env.commandStr);
                  var cmp = value.cmp || 'keep';
                  var ref = value.ref || 0;
                  var mask = 'mask' in value ? value.mask : -1;
                  check$1.commandParameter(cmp, compareFuncs, prop + '.cmp', env.commandStr);
                  check$1.commandType(ref, 'number', prop + '.ref', env.commandStr);
                  check$1.commandType(mask, 'number', prop + '.mask', env.commandStr);
                  return [
                    compareFuncs[cmp],
                    ref,
                    mask
                  ]
                },
                function (env, scope, value) {
                  var COMPARE_FUNCS = env.constants.compareFuncs;
                  check$1.optional(function () {
                    function assert () {
                      env.assert(scope,
                        Array.prototype.join.call(arguments, ''),
                        'invalid stencil.func');
                    }
                    assert(value + '&&typeof ', value, '==="object"');
                    assert('!("cmp" in ', value, ')||(',
                      value, '.cmp in ', COMPARE_FUNCS, ')');
                  });
                  var cmp = scope.def(
                    '"cmp" in ', value,
                    '?', COMPARE_FUNCS, '[', value, '.cmp]',
                    ':', GL_KEEP);
                  var ref = scope.def(value, '.ref|0');
                  var mask = scope.def(
                    '"mask" in ', value,
                    '?', value, '.mask|0:-1');
                  return [cmp, ref, mask]
                })

            case S_STENCIL_OPFRONT:
            case S_STENCIL_OPBACK:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'object', param, env.commandStr);
                  var fail = value.fail || 'keep';
                  var zfail = value.zfail || 'keep';
                  var zpass = value.zpass || 'keep';
                  check$1.commandParameter(fail, stencilOps, prop + '.fail', env.commandStr);
                  check$1.commandParameter(zfail, stencilOps, prop + '.zfail', env.commandStr);
                  check$1.commandParameter(zpass, stencilOps, prop + '.zpass', env.commandStr);
                  return [
                    prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT,
                    stencilOps[fail],
                    stencilOps[zfail],
                    stencilOps[zpass]
                  ]
                },
                function (env, scope, value) {
                  var STENCIL_OPS = env.constants.stencilOps;

                  check$1.optional(function () {
                    env.assert(scope,
                      value + '&&typeof ' + value + '==="object"',
                      'invalid ' + prop);
                  });

                  function read (name) {
                    check$1.optional(function () {
                      env.assert(scope,
                        '!("' + name + '" in ' + value + ')||' +
                        '(' + value + '.' + name + ' in ' + STENCIL_OPS + ')',
                        'invalid ' + prop + '.' + name + ', must be one of ' + Object.keys(stencilOps));
                    });

                    return scope.def(
                      '"', name, '" in ', value,
                      '?', STENCIL_OPS, '[', value, '.', name, ']:',
                      GL_KEEP)
                  }

                  return [
                    prop === S_STENCIL_OPBACK ? GL_BACK : GL_FRONT,
                    read('fail'),
                    read('zfail'),
                    read('zpass')
                  ]
                })

            case S_POLYGON_OFFSET_OFFSET:
              return parseParam(
                function (value) {
                  check$1.commandType(value, 'object', param, env.commandStr);
                  var factor = value.factor | 0;
                  var units = value.units | 0;
                  check$1.commandType(factor, 'number', param + '.factor', env.commandStr);
                  check$1.commandType(units, 'number', param + '.units', env.commandStr);
                  return [factor, units]
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      value + '&&typeof ' + value + '==="object"',
                      'invalid ' + prop);
                  });

                  var FACTOR = scope.def(value, '.factor|0');
                  var UNITS = scope.def(value, '.units|0');

                  return [FACTOR, UNITS]
                })

            case S_CULL_FACE:
              return parseParam(
                function (value) {
                  var face = 0;
                  if (value === 'front') {
                    face = GL_FRONT;
                  } else if (value === 'back') {
                    face = GL_BACK;
                  }
                  check$1.command(!!face, param, env.commandStr);
                  return face
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      value + '==="front"||' +
                      value + '==="back"',
                      'invalid cull.face');
                  });
                  return scope.def(value, '==="front"?', GL_FRONT, ':', GL_BACK)
                })

            case S_LINE_WIDTH:
              return parseParam(
                function (value) {
                  check$1.command(
                    typeof value === 'number' &&
                    value >= limits.lineWidthDims[0] &&
                    value <= limits.lineWidthDims[1],
                    'invalid line width, must be a positive number between ' +
                    limits.lineWidthDims[0] + ' and ' + limits.lineWidthDims[1], env.commandStr);
                  return value
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      'typeof ' + value + '==="number"&&' +
                      value + '>=' + limits.lineWidthDims[0] + '&&' +
                      value + '<=' + limits.lineWidthDims[1],
                      'invalid line width');
                  });

                  return value
                })

            case S_FRONT_FACE:
              return parseParam(
                function (value) {
                  check$1.commandParameter(value, orientationType, param, env.commandStr);
                  return orientationType[value]
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      value + '==="cw"||' +
                      value + '==="ccw"',
                      'invalid frontFace, must be one of cw,ccw');
                  });
                  return scope.def(value + '==="cw"?' + GL_CW + ':' + GL_CCW)
                })

            case S_COLOR_MASK:
              return parseParam(
                function (value) {
                  check$1.command(
                    isArrayLike(value) && value.length === 4,
                    'color.mask must be length 4 array', env.commandStr);
                  return value.map(function (v) { return !!v })
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      env.shared.isArrayLike + '(' + value + ')&&' +
                      value + '.length===4',
                      'invalid color.mask');
                  });
                  return loop(4, function (i) {
                    return '!!' + value + '[' + i + ']'
                  })
                })

            case S_SAMPLE_COVERAGE:
              return parseParam(
                function (value) {
                  check$1.command(typeof value === 'object' && value, param, env.commandStr);
                  var sampleValue = 'value' in value ? value.value : 1;
                  var sampleInvert = !!value.invert;
                  check$1.command(
                    typeof sampleValue === 'number' &&
                    sampleValue >= 0 && sampleValue <= 1,
                    'sample.coverage.value must be a number between 0 and 1', env.commandStr);
                  return [sampleValue, sampleInvert]
                },
                function (env, scope, value) {
                  check$1.optional(function () {
                    env.assert(scope,
                      value + '&&typeof ' + value + '==="object"',
                      'invalid sample.coverage');
                  });
                  var VALUE = scope.def(
                    '"value" in ', value, '?+', value, '.value:1');
                  var INVERT = scope.def('!!', value, '.invert');
                  return [VALUE, INVERT]
                })
          }
        });

        return STATE
      }

      function parseUniforms (uniforms, env) {
        var staticUniforms = uniforms.static;
        var dynamicUniforms = uniforms.dynamic;

        var UNIFORMS = {};

        Object.keys(staticUniforms).forEach(function (name) {
          var value = staticUniforms[name];
          var result;
          if (typeof value === 'number' ||
              typeof value === 'boolean') {
            result = createStaticDecl(function () {
              return value
            });
          } else if (typeof value === 'function') {
            var reglType = value._reglType;
            if (reglType === 'texture2d' ||
                reglType === 'textureCube') {
              result = createStaticDecl(function (env) {
                return env.link(value)
              });
            } else if (reglType === 'framebuffer' ||
                       reglType === 'framebufferCube') {
              check$1.command(value.color.length > 0,
                'missing color attachment for framebuffer sent to uniform "' + name + '"', env.commandStr);
              result = createStaticDecl(function (env) {
                return env.link(value.color[0])
              });
            } else {
              check$1.commandRaise('invalid data for uniform "' + name + '"', env.commandStr);
            }
          } else if (isArrayLike(value)) {
            result = createStaticDecl(function (env) {
              var ITEM = env.global.def('[',
                loop(value.length, function (i) {
                  check$1.command(
                    typeof value[i] === 'number' ||
                    typeof value[i] === 'boolean',
                    'invalid uniform ' + name, env.commandStr);
                  return value[i]
                }), ']');
              return ITEM
            });
          } else {
            check$1.commandRaise('invalid or missing data for uniform "' + name + '"', env.commandStr);
          }
          result.value = value;
          UNIFORMS[name] = result;
        });

        Object.keys(dynamicUniforms).forEach(function (key) {
          var dyn = dynamicUniforms[key];
          UNIFORMS[key] = createDynamicDecl(dyn, function (env, scope) {
            return env.invoke(scope, dyn)
          });
        });

        return UNIFORMS
      }

      function parseAttributes (attributes, env) {
        var staticAttributes = attributes.static;
        var dynamicAttributes = attributes.dynamic;

        var attributeDefs = {};

        Object.keys(staticAttributes).forEach(function (attribute) {
          var value = staticAttributes[attribute];
          var id = stringStore.id(attribute);

          var record = new AttributeRecord();
          if (isBufferArgs(value)) {
            record.state = ATTRIB_STATE_POINTER;
            record.buffer = bufferState.getBuffer(
              bufferState.create(value, GL_ARRAY_BUFFER$2, false, true));
            record.type = 0;
          } else {
            var buffer = bufferState.getBuffer(value);
            if (buffer) {
              record.state = ATTRIB_STATE_POINTER;
              record.buffer = buffer;
              record.type = 0;
            } else {
              check$1.command(typeof value === 'object' && value,
                'invalid data for attribute ' + attribute, env.commandStr);
              if ('constant' in value) {
                var constant = value.constant;
                record.buffer = 'null';
                record.state = ATTRIB_STATE_CONSTANT;
                if (typeof constant === 'number') {
                  record.x = constant;
                } else {
                  check$1.command(
                    isArrayLike(constant) &&
                    constant.length > 0 &&
                    constant.length <= 4,
                    'invalid constant for attribute ' + attribute, env.commandStr);
                  CUTE_COMPONENTS.forEach(function (c, i) {
                    if (i < constant.length) {
                      record[c] = constant[i];
                    }
                  });
                }
              } else {
                if (isBufferArgs(value.buffer)) {
                  buffer = bufferState.getBuffer(
                    bufferState.create(value.buffer, GL_ARRAY_BUFFER$2, false, true));
                } else {
                  buffer = bufferState.getBuffer(value.buffer);
                }
                check$1.command(!!buffer, 'missing buffer for attribute "' + attribute + '"', env.commandStr);

                var offset = value.offset | 0;
                check$1.command(offset >= 0,
                  'invalid offset for attribute "' + attribute + '"', env.commandStr);

                var stride = value.stride | 0;
                check$1.command(stride >= 0 && stride < 256,
                  'invalid stride for attribute "' + attribute + '", must be integer betweeen [0, 255]', env.commandStr);

                var size = value.size | 0;
                check$1.command(!('size' in value) || (size > 0 && size <= 4),
                  'invalid size for attribute "' + attribute + '", must be 1,2,3,4', env.commandStr);

                var normalized = !!value.normalized;

                var type = 0;
                if ('type' in value) {
                  check$1.commandParameter(
                    value.type, glTypes,
                    'invalid type for attribute ' + attribute, env.commandStr);
                  type = glTypes[value.type];
                }

                var divisor = value.divisor | 0;
                if ('divisor' in value) {
                  check$1.command(divisor === 0 || extInstancing,
                    'cannot specify divisor for attribute "' + attribute + '", instancing not supported', env.commandStr);
                  check$1.command(divisor >= 0,
                    'invalid divisor for attribute "' + attribute + '"', env.commandStr);
                }

                check$1.optional(function () {
                  var command = env.commandStr;

                  var VALID_KEYS = [
                    'buffer',
                    'offset',
                    'divisor',
                    'normalized',
                    'type',
                    'size',
                    'stride'
                  ];

                  Object.keys(value).forEach(function (prop) {
                    check$1.command(
                      VALID_KEYS.indexOf(prop) >= 0,
                      'unknown parameter "' + prop + '" for attribute pointer "' + attribute + '" (valid parameters are ' + VALID_KEYS + ')',
                      command);
                  });
                });

                record.buffer = buffer;
                record.state = ATTRIB_STATE_POINTER;
                record.size = size;
                record.normalized = normalized;
                record.type = type || buffer.dtype;
                record.offset = offset;
                record.stride = stride;
                record.divisor = divisor;
              }
            }
          }

          attributeDefs[attribute] = createStaticDecl(function (env, scope) {
            var cache = env.attribCache;
            if (id in cache) {
              return cache[id]
            }
            var result = {
              isStream: false
            };
            Object.keys(record).forEach(function (key) {
              result[key] = record[key];
            });
            if (record.buffer) {
              result.buffer = env.link(record.buffer);
              result.type = result.type || (result.buffer + '.dtype');
            }
            cache[id] = result;
            return result
          });
        });

        Object.keys(dynamicAttributes).forEach(function (attribute) {
          var dyn = dynamicAttributes[attribute];

          function appendAttributeCode (env, block) {
            var VALUE = env.invoke(block, dyn);

            var shared = env.shared;
            var constants = env.constants;

            var IS_BUFFER_ARGS = shared.isBufferArgs;
            var BUFFER_STATE = shared.buffer;

            // Perform validation on attribute
            check$1.optional(function () {
              env.assert(block,
                VALUE + '&&(typeof ' + VALUE + '==="object"||typeof ' +
                VALUE + '==="function")&&(' +
                IS_BUFFER_ARGS + '(' + VALUE + ')||' +
                BUFFER_STATE + '.getBuffer(' + VALUE + ')||' +
                BUFFER_STATE + '.getBuffer(' + VALUE + '.buffer)||' +
                IS_BUFFER_ARGS + '(' + VALUE + '.buffer)||' +
                '("constant" in ' + VALUE +
                '&&(typeof ' + VALUE + '.constant==="number"||' +
                shared.isArrayLike + '(' + VALUE + '.constant))))',
                'invalid dynamic attribute "' + attribute + '"');
            });

            // allocate names for result
            var result = {
              isStream: block.def(false)
            };
            var defaultRecord = new AttributeRecord();
            defaultRecord.state = ATTRIB_STATE_POINTER;
            Object.keys(defaultRecord).forEach(function (key) {
              result[key] = block.def('' + defaultRecord[key]);
            });

            var BUFFER = result.buffer;
            var TYPE = result.type;
            block(
              'if(', IS_BUFFER_ARGS, '(', VALUE, ')){',
              result.isStream, '=true;',
              BUFFER, '=', BUFFER_STATE, '.createStream(', GL_ARRAY_BUFFER$2, ',', VALUE, ');',
              TYPE, '=', BUFFER, '.dtype;',
              '}else{',
              BUFFER, '=', BUFFER_STATE, '.getBuffer(', VALUE, ');',
              'if(', BUFFER, '){',
              TYPE, '=', BUFFER, '.dtype;',
              '}else if("constant" in ', VALUE, '){',
              result.state, '=', ATTRIB_STATE_CONSTANT, ';',
              'if(typeof ' + VALUE + '.constant === "number"){',
              result[CUTE_COMPONENTS[0]], '=', VALUE, '.constant;',
              CUTE_COMPONENTS.slice(1).map(function (n) {
                return result[n]
              }).join('='), '=0;',
              '}else{',
              CUTE_COMPONENTS.map(function (name, i) {
                return (
                  result[name] + '=' + VALUE + '.constant.length>' + i +
                  '?' + VALUE + '.constant[' + i + ']:0;'
                )
              }).join(''),
              '}}else{',
              'if(', IS_BUFFER_ARGS, '(', VALUE, '.buffer)){',
              BUFFER, '=', BUFFER_STATE, '.createStream(', GL_ARRAY_BUFFER$2, ',', VALUE, '.buffer);',
              '}else{',
              BUFFER, '=', BUFFER_STATE, '.getBuffer(', VALUE, '.buffer);',
              '}',
              TYPE, '="type" in ', VALUE, '?',
              constants.glTypes, '[', VALUE, '.type]:', BUFFER, '.dtype;',
              result.normalized, '=!!', VALUE, '.normalized;');
            function emitReadRecord (name) {
              block(result[name], '=', VALUE, '.', name, '|0;');
            }
            emitReadRecord('size');
            emitReadRecord('offset');
            emitReadRecord('stride');
            emitReadRecord('divisor');

            block('}}');

            block.exit(
              'if(', result.isStream, '){',
              BUFFER_STATE, '.destroyStream(', BUFFER, ');',
              '}');

            return result
          }

          attributeDefs[attribute] = createDynamicDecl(dyn, appendAttributeCode);
        });

        return attributeDefs
      }

      function parseVAO (options, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;
        if (S_VAO in staticOptions) {
          var vao = staticOptions[S_VAO];
          if (vao !== null && attributeState.getVAO(vao) === null) {
            vao = attributeState.createVAO(vao);
          }
          return createStaticDecl(function (env) {
            return env.link(attributeState.getVAO(vao))
          })
        } else if (S_VAO in dynamicOptions) {
          var dyn = dynamicOptions[S_VAO];
          return createDynamicDecl(dyn, function (env, scope) {
            var vaoRef = env.invoke(scope, dyn);
            return scope.def(env.shared.vao + '.getVAO(' + vaoRef + ')')
          })
        }
        return null
      }

      function parseContext (context) {
        var staticContext = context.static;
        var dynamicContext = context.dynamic;
        var result = {};

        Object.keys(staticContext).forEach(function (name) {
          var value = staticContext[name];
          result[name] = createStaticDecl(function (env, scope) {
            if (typeof value === 'number' || typeof value === 'boolean') {
              return '' + value
            } else {
              return env.link(value)
            }
          });
        });

        Object.keys(dynamicContext).forEach(function (name) {
          var dyn = dynamicContext[name];
          result[name] = createDynamicDecl(dyn, function (env, scope) {
            return env.invoke(scope, dyn)
          });
        });

        return result
      }

      function parseArguments (options, attributes, uniforms, context, env) {
        var staticOptions = options.static;
        var dynamicOptions = options.dynamic;

        check$1.optional(function () {
          var KEY_NAMES = [
            S_FRAMEBUFFER,
            S_VERT,
            S_FRAG,
            S_ELEMENTS,
            S_PRIMITIVE,
            S_OFFSET,
            S_COUNT,
            S_INSTANCES,
            S_PROFILE,
            S_VAO
          ].concat(GL_STATE_NAMES);

          function checkKeys (dict) {
            Object.keys(dict).forEach(function (key) {
              check$1.command(
                KEY_NAMES.indexOf(key) >= 0,
                'unknown parameter "' + key + '"',
                env.commandStr);
            });
          }

          checkKeys(staticOptions);
          checkKeys(dynamicOptions);
        });

        var attribLocations = parseAttribLocations(options, attributes);

        var framebuffer = parseFramebuffer(options);
        var viewportAndScissor = parseViewportScissor(options, framebuffer, env);
        var draw = parseDraw(options, env);
        var state = parseGLState(options, env);
        var shader = parseProgram(options, env, attribLocations);

        function copyBox (name) {
          var defn = viewportAndScissor[name];
          if (defn) {
            state[name] = defn;
          }
        }
        copyBox(S_VIEWPORT);
        copyBox(propName(S_SCISSOR_BOX));

        var dirty = Object.keys(state).length > 0;

        var result = {
          framebuffer: framebuffer,
          draw: draw,
          shader: shader,
          state: state,
          dirty: dirty,
          scopeVAO: null,
          drawVAO: null,
          useVAO: false,
          attributes: {}
        };

        result.profile = parseProfile(options);
        result.uniforms = parseUniforms(uniforms, env);
        result.drawVAO = result.scopeVAO = parseVAO(options);
        // special case: check if we can statically allocate a vertex array object for this program
        if (!result.drawVAO && shader.program && !attribLocations && extensions.angle_instanced_arrays) {
          var useVAO = true;
          var staticBindings = shader.program.attributes.map(function (attr) {
            var binding = attributes.static[attr];
            useVAO = useVAO && !!binding;
            return binding
          });
          if (useVAO && staticBindings.length > 0) {
            var vao = attributeState.getVAO(attributeState.createVAO(staticBindings));
            result.drawVAO = new Declaration(null, null, null, function (env, scope) {
              return env.link(vao)
            });
            result.useVAO = true;
          }
        }
        if (attribLocations) {
          result.useVAO = true;
        } else {
          result.attributes = parseAttributes(attributes, env);
        }
        result.context = parseContext(context);
        return result
      }

      // ===================================================
      // ===================================================
      // COMMON UPDATE FUNCTIONS
      // ===================================================
      // ===================================================
      function emitContext (env, scope, context) {
        var shared = env.shared;
        var CONTEXT = shared.context;

        var contextEnter = env.scope();

        Object.keys(context).forEach(function (name) {
          scope.save(CONTEXT, '.' + name);
          var defn = context[name];
          var value = defn.append(env, scope);
          if (Array.isArray(value)) {
            contextEnter(CONTEXT, '.', name, '=[', value.join(), '];');
          } else {
            contextEnter(CONTEXT, '.', name, '=', value, ';');
          }
        });

        scope(contextEnter);
      }

      // ===================================================
      // ===================================================
      // COMMON DRAWING FUNCTIONS
      // ===================================================
      // ===================================================
      function emitPollFramebuffer (env, scope, framebuffer, skipCheck) {
        var shared = env.shared;

        var GL = shared.gl;
        var FRAMEBUFFER_STATE = shared.framebuffer;
        var EXT_DRAW_BUFFERS;
        if (extDrawBuffers) {
          EXT_DRAW_BUFFERS = scope.def(shared.extensions, '.webgl_draw_buffers');
        }

        var constants = env.constants;

        var DRAW_BUFFERS = constants.drawBuffer;
        var BACK_BUFFER = constants.backBuffer;

        var NEXT;
        if (framebuffer) {
          NEXT = framebuffer.append(env, scope);
        } else {
          NEXT = scope.def(FRAMEBUFFER_STATE, '.next');
        }

        if (!skipCheck) {
          scope('if(', NEXT, '!==', FRAMEBUFFER_STATE, '.cur){');
        }
        scope(
          'if(', NEXT, '){',
          GL, '.bindFramebuffer(', GL_FRAMEBUFFER$2, ',', NEXT, '.framebuffer);');
        if (extDrawBuffers) {
          scope(EXT_DRAW_BUFFERS, '.drawBuffersWEBGL(',
            DRAW_BUFFERS, '[', NEXT, '.colorAttachments.length]);');
        }
        scope('}else{',
          GL, '.bindFramebuffer(', GL_FRAMEBUFFER$2, ',null);');
        if (extDrawBuffers) {
          scope(EXT_DRAW_BUFFERS, '.drawBuffersWEBGL(', BACK_BUFFER, ');');
        }
        scope(
          '}',
          FRAMEBUFFER_STATE, '.cur=', NEXT, ';');
        if (!skipCheck) {
          scope('}');
        }
      }

      function emitPollState (env, scope, args) {
        var shared = env.shared;

        var GL = shared.gl;

        var CURRENT_VARS = env.current;
        var NEXT_VARS = env.next;
        var CURRENT_STATE = shared.current;
        var NEXT_STATE = shared.next;

        var block = env.cond(CURRENT_STATE, '.dirty');

        GL_STATE_NAMES.forEach(function (prop) {
          var param = propName(prop);
          if (param in args.state) {
            return
          }

          var NEXT, CURRENT;
          if (param in NEXT_VARS) {
            NEXT = NEXT_VARS[param];
            CURRENT = CURRENT_VARS[param];
            var parts = loop(currentState[param].length, function (i) {
              return block.def(NEXT, '[', i, ']')
            });
            block(env.cond(parts.map(function (p, i) {
              return p + '!==' + CURRENT + '[' + i + ']'
            }).join('||'))
              .then(
                GL, '.', GL_VARIABLES[param], '(', parts, ');',
                parts.map(function (p, i) {
                  return CURRENT + '[' + i + ']=' + p
                }).join(';'), ';'));
          } else {
            NEXT = block.def(NEXT_STATE, '.', param);
            var ifte = env.cond(NEXT, '!==', CURRENT_STATE, '.', param);
            block(ifte);
            if (param in GL_FLAGS) {
              ifte(
                env.cond(NEXT)
                  .then(GL, '.enable(', GL_FLAGS[param], ');')
                  .else(GL, '.disable(', GL_FLAGS[param], ');'),
                CURRENT_STATE, '.', param, '=', NEXT, ';');
            } else {
              ifte(
                GL, '.', GL_VARIABLES[param], '(', NEXT, ');',
                CURRENT_STATE, '.', param, '=', NEXT, ';');
            }
          }
        });
        if (Object.keys(args.state).length === 0) {
          block(CURRENT_STATE, '.dirty=false;');
        }
        scope(block);
      }

      function emitSetOptions (env, scope, options, filter) {
        var shared = env.shared;
        var CURRENT_VARS = env.current;
        var CURRENT_STATE = shared.current;
        var GL = shared.gl;
        sortState(Object.keys(options)).forEach(function (param) {
          var defn = options[param];
          if (filter && !filter(defn)) {
            return
          }
          var variable = defn.append(env, scope);
          if (GL_FLAGS[param]) {
            var flag = GL_FLAGS[param];
            if (isStatic(defn)) {
              if (variable) {
                scope(GL, '.enable(', flag, ');');
              } else {
                scope(GL, '.disable(', flag, ');');
              }
            } else {
              scope(env.cond(variable)
                .then(GL, '.enable(', flag, ');')
                .else(GL, '.disable(', flag, ');'));
            }
            scope(CURRENT_STATE, '.', param, '=', variable, ';');
          } else if (isArrayLike(variable)) {
            var CURRENT = CURRENT_VARS[param];
            scope(
              GL, '.', GL_VARIABLES[param], '(', variable, ');',
              variable.map(function (v, i) {
                return CURRENT + '[' + i + ']=' + v
              }).join(';'), ';');
          } else {
            scope(
              GL, '.', GL_VARIABLES[param], '(', variable, ');',
              CURRENT_STATE, '.', param, '=', variable, ';');
          }
        });
      }

      function injectExtensions (env, scope) {
        if (extInstancing) {
          env.instancing = scope.def(
            env.shared.extensions, '.angle_instanced_arrays');
        }
      }

      function emitProfile (env, scope, args, useScope, incrementCounter) {
        var shared = env.shared;
        var STATS = env.stats;
        var CURRENT_STATE = shared.current;
        var TIMER = shared.timer;
        var profileArg = args.profile;

        function perfCounter () {
          if (typeof performance === 'undefined') {
            return 'Date.now()'
          } else {
            return 'performance.now()'
          }
        }

        var CPU_START, QUERY_COUNTER;
        function emitProfileStart (block) {
          CPU_START = scope.def();
          block(CPU_START, '=', perfCounter(), ';');
          if (typeof incrementCounter === 'string') {
            block(STATS, '.count+=', incrementCounter, ';');
          } else {
            block(STATS, '.count++;');
          }
          if (timer) {
            if (useScope) {
              QUERY_COUNTER = scope.def();
              block(QUERY_COUNTER, '=', TIMER, '.getNumPendingQueries();');
            } else {
              block(TIMER, '.beginQuery(', STATS, ');');
            }
          }
        }

        function emitProfileEnd (block) {
          block(STATS, '.cpuTime+=', perfCounter(), '-', CPU_START, ';');
          if (timer) {
            if (useScope) {
              block(TIMER, '.pushScopeStats(',
                QUERY_COUNTER, ',',
                TIMER, '.getNumPendingQueries(),',
                STATS, ');');
            } else {
              block(TIMER, '.endQuery();');
            }
          }
        }

        function scopeProfile (value) {
          var prev = scope.def(CURRENT_STATE, '.profile');
          scope(CURRENT_STATE, '.profile=', value, ';');
          scope.exit(CURRENT_STATE, '.profile=', prev, ';');
        }

        var USE_PROFILE;
        if (profileArg) {
          if (isStatic(profileArg)) {
            if (profileArg.enable) {
              emitProfileStart(scope);
              emitProfileEnd(scope.exit);
              scopeProfile('true');
            } else {
              scopeProfile('false');
            }
            return
          }
          USE_PROFILE = profileArg.append(env, scope);
          scopeProfile(USE_PROFILE);
        } else {
          USE_PROFILE = scope.def(CURRENT_STATE, '.profile');
        }

        var start = env.block();
        emitProfileStart(start);
        scope('if(', USE_PROFILE, '){', start, '}');
        var end = env.block();
        emitProfileEnd(end);
        scope.exit('if(', USE_PROFILE, '){', end, '}');
      }

      function emitAttributes (env, scope, args, attributes, filter) {
        var shared = env.shared;

        function typeLength (x) {
          switch (x) {
            case GL_FLOAT_VEC2:
            case GL_INT_VEC2:
            case GL_BOOL_VEC2:
              return 2
            case GL_FLOAT_VEC3:
            case GL_INT_VEC3:
            case GL_BOOL_VEC3:
              return 3
            case GL_FLOAT_VEC4:
            case GL_INT_VEC4:
            case GL_BOOL_VEC4:
              return 4
            default:
              return 1
          }
        }

        function emitBindAttribute (ATTRIBUTE, size, record) {
          var GL = shared.gl;

          var LOCATION = scope.def(ATTRIBUTE, '.location');
          var BINDING = scope.def(shared.attributes, '[', LOCATION, ']');

          var STATE = record.state;
          var BUFFER = record.buffer;
          var CONST_COMPONENTS = [
            record.x,
            record.y,
            record.z,
            record.w
          ];

          var COMMON_KEYS = [
            'buffer',
            'normalized',
            'offset',
            'stride'
          ];

          function emitBuffer () {
            scope(
              'if(!', BINDING, '.buffer){',
              GL, '.enableVertexAttribArray(', LOCATION, ');}');

            var TYPE = record.type;
            var SIZE;
            if (!record.size) {
              SIZE = size;
            } else {
              SIZE = scope.def(record.size, '||', size);
            }

            scope('if(',
              BINDING, '.type!==', TYPE, '||',
              BINDING, '.size!==', SIZE, '||',
              COMMON_KEYS.map(function (key) {
                return BINDING + '.' + key + '!==' + record[key]
              }).join('||'),
              '){',
              GL, '.bindBuffer(', GL_ARRAY_BUFFER$2, ',', BUFFER, '.buffer);',
              GL, '.vertexAttribPointer(', [
                LOCATION,
                SIZE,
                TYPE,
                record.normalized,
                record.stride,
                record.offset
              ], ');',
              BINDING, '.type=', TYPE, ';',
              BINDING, '.size=', SIZE, ';',
              COMMON_KEYS.map(function (key) {
                return BINDING + '.' + key + '=' + record[key] + ';'
              }).join(''),
              '}');

            if (extInstancing) {
              var DIVISOR = record.divisor;
              scope(
                'if(', BINDING, '.divisor!==', DIVISOR, '){',
                env.instancing, '.vertexAttribDivisorANGLE(', [LOCATION, DIVISOR], ');',
                BINDING, '.divisor=', DIVISOR, ';}');
            }
          }

          function emitConstant () {
            scope(
              'if(', BINDING, '.buffer){',
              GL, '.disableVertexAttribArray(', LOCATION, ');',
              BINDING, '.buffer=null;',
              '}if(', CUTE_COMPONENTS.map(function (c, i) {
                return BINDING + '.' + c + '!==' + CONST_COMPONENTS[i]
              }).join('||'), '){',
              GL, '.vertexAttrib4f(', LOCATION, ',', CONST_COMPONENTS, ');',
              CUTE_COMPONENTS.map(function (c, i) {
                return BINDING + '.' + c + '=' + CONST_COMPONENTS[i] + ';'
              }).join(''),
              '}');
          }

          if (STATE === ATTRIB_STATE_POINTER) {
            emitBuffer();
          } else if (STATE === ATTRIB_STATE_CONSTANT) {
            emitConstant();
          } else {
            scope('if(', STATE, '===', ATTRIB_STATE_POINTER, '){');
            emitBuffer();
            scope('}else{');
            emitConstant();
            scope('}');
          }
        }

        attributes.forEach(function (attribute) {
          var name = attribute.name;
          var arg = args.attributes[name];
          var record;
          if (arg) {
            if (!filter(arg)) {
              return
            }
            record = arg.append(env, scope);
          } else {
            if (!filter(SCOPE_DECL)) {
              return
            }
            var scopeAttrib = env.scopeAttrib(name);
            check$1.optional(function () {
              env.assert(scope,
                scopeAttrib + '.state',
                'missing attribute ' + name);
            });
            record = {};
            Object.keys(new AttributeRecord()).forEach(function (key) {
              record[key] = scope.def(scopeAttrib, '.', key);
            });
          }
          emitBindAttribute(
            env.link(attribute), typeLength(attribute.info.type), record);
        });
      }

      function emitUniforms (env, scope, args, uniforms, filter) {
        var shared = env.shared;
        var GL = shared.gl;

        var infix;
        for (var i = 0; i < uniforms.length; ++i) {
          var uniform = uniforms[i];
          var name = uniform.name;
          var type = uniform.info.type;
          var arg = args.uniforms[name];
          var UNIFORM = env.link(uniform);
          var LOCATION = UNIFORM + '.location';

          var VALUE;
          if (arg) {
            if (!filter(arg)) {
              continue
            }
            if (isStatic(arg)) {
              var value = arg.value;
              check$1.command(
                value !== null && typeof value !== 'undefined',
                'missing uniform "' + name + '"', env.commandStr);
              if (type === GL_SAMPLER_2D || type === GL_SAMPLER_CUBE) {
                check$1.command(
                  typeof value === 'function' &&
                  ((type === GL_SAMPLER_2D &&
                    (value._reglType === 'texture2d' ||
                    value._reglType === 'framebuffer')) ||
                  (type === GL_SAMPLER_CUBE &&
                    (value._reglType === 'textureCube' ||
                    value._reglType === 'framebufferCube'))),
                  'invalid texture for uniform ' + name, env.commandStr);
                var TEX_VALUE = env.link(value._texture || value.color[0]._texture);
                scope(GL, '.uniform1i(', LOCATION, ',', TEX_VALUE + '.bind());');
                scope.exit(TEX_VALUE, '.unbind();');
              } else if (
                type === GL_FLOAT_MAT2 ||
                type === GL_FLOAT_MAT3 ||
                type === GL_FLOAT_MAT4) {
                check$1.optional(function () {
                  check$1.command(isArrayLike(value),
                    'invalid matrix for uniform ' + name, env.commandStr);
                  check$1.command(
                    (type === GL_FLOAT_MAT2 && value.length === 4) ||
                    (type === GL_FLOAT_MAT3 && value.length === 9) ||
                    (type === GL_FLOAT_MAT4 && value.length === 16),
                    'invalid length for matrix uniform ' + name, env.commandStr);
                });
                var MAT_VALUE = env.global.def('new Float32Array([' +
                  Array.prototype.slice.call(value) + '])');
                var dim = 2;
                if (type === GL_FLOAT_MAT3) {
                  dim = 3;
                } else if (type === GL_FLOAT_MAT4) {
                  dim = 4;
                }
                scope(
                  GL, '.uniformMatrix', dim, 'fv(',
                  LOCATION, ',false,', MAT_VALUE, ');');
              } else {
                switch (type) {
                  case GL_FLOAT$8:
                    check$1.commandType(value, 'number', 'uniform ' + name, env.commandStr);
                    infix = '1f';
                    break
                  case GL_FLOAT_VEC2:
                    check$1.command(
                      isArrayLike(value) && value.length === 2,
                      'uniform ' + name, env.commandStr);
                    infix = '2f';
                    break
                  case GL_FLOAT_VEC3:
                    check$1.command(
                      isArrayLike(value) && value.length === 3,
                      'uniform ' + name, env.commandStr);
                    infix = '3f';
                    break
                  case GL_FLOAT_VEC4:
                    check$1.command(
                      isArrayLike(value) && value.length === 4,
                      'uniform ' + name, env.commandStr);
                    infix = '4f';
                    break
                  case GL_BOOL:
                    check$1.commandType(value, 'boolean', 'uniform ' + name, env.commandStr);
                    infix = '1i';
                    break
                  case GL_INT$3:
                    check$1.commandType(value, 'number', 'uniform ' + name, env.commandStr);
                    infix = '1i';
                    break
                  case GL_BOOL_VEC2:
                    check$1.command(
                      isArrayLike(value) && value.length === 2,
                      'uniform ' + name, env.commandStr);
                    infix = '2i';
                    break
                  case GL_INT_VEC2:
                    check$1.command(
                      isArrayLike(value) && value.length === 2,
                      'uniform ' + name, env.commandStr);
                    infix = '2i';
                    break
                  case GL_BOOL_VEC3:
                    check$1.command(
                      isArrayLike(value) && value.length === 3,
                      'uniform ' + name, env.commandStr);
                    infix = '3i';
                    break
                  case GL_INT_VEC3:
                    check$1.command(
                      isArrayLike(value) && value.length === 3,
                      'uniform ' + name, env.commandStr);
                    infix = '3i';
                    break
                  case GL_BOOL_VEC4:
                    check$1.command(
                      isArrayLike(value) && value.length === 4,
                      'uniform ' + name, env.commandStr);
                    infix = '4i';
                    break
                  case GL_INT_VEC4:
                    check$1.command(
                      isArrayLike(value) && value.length === 4,
                      'uniform ' + name, env.commandStr);
                    infix = '4i';
                    break
                }
                scope(GL, '.uniform', infix, '(', LOCATION, ',',
                  isArrayLike(value) ? Array.prototype.slice.call(value) : value,
                  ');');
              }
              continue
            } else {
              VALUE = arg.append(env, scope);
            }
          } else {
            if (!filter(SCOPE_DECL)) {
              continue
            }
            VALUE = scope.def(shared.uniforms, '[', stringStore.id(name), ']');
          }

          if (type === GL_SAMPLER_2D) {
            check$1(!Array.isArray(VALUE), 'must specify a scalar prop for textures');
            scope(
              'if(', VALUE, '&&', VALUE, '._reglType==="framebuffer"){',
              VALUE, '=', VALUE, '.color[0];',
              '}');
          } else if (type === GL_SAMPLER_CUBE) {
            check$1(!Array.isArray(VALUE), 'must specify a scalar prop for cube maps');
            scope(
              'if(', VALUE, '&&', VALUE, '._reglType==="framebufferCube"){',
              VALUE, '=', VALUE, '.color[0];',
              '}');
          }

          // perform type validation
          check$1.optional(function () {
            function emitCheck (pred, message) {
              env.assert(scope, pred,
                'bad data or missing for uniform "' + name + '".  ' + message);
            }

            function checkType (type) {
              check$1(!Array.isArray(VALUE), 'must not specify an array type for uniform');
              emitCheck(
                'typeof ' + VALUE + '==="' + type + '"',
                'invalid type, expected ' + type);
            }

            function checkVector (n, type) {
              if (Array.isArray(VALUE)) {
                check$1(VALUE.length === n, 'must have length ' + n);
              } else {
                emitCheck(
                  shared.isArrayLike + '(' + VALUE + ')&&' + VALUE + '.length===' + n,
                  'invalid vector, should have length ' + n, env.commandStr);
              }
            }

            function checkTexture (target) {
              check$1(!Array.isArray(VALUE), 'must not specify a value type');
              emitCheck(
                'typeof ' + VALUE + '==="function"&&' +
                VALUE + '._reglType==="texture' +
                (target === GL_TEXTURE_2D$3 ? '2d' : 'Cube') + '"',
                'invalid texture type', env.commandStr);
            }

            switch (type) {
              case GL_INT$3:
                checkType('number');
                break
              case GL_INT_VEC2:
                checkVector(2);
                break
              case GL_INT_VEC3:
                checkVector(3);
                break
              case GL_INT_VEC4:
                checkVector(4);
                break
              case GL_FLOAT$8:
                checkType('number');
                break
              case GL_FLOAT_VEC2:
                checkVector(2);
                break
              case GL_FLOAT_VEC3:
                checkVector(3);
                break
              case GL_FLOAT_VEC4:
                checkVector(4);
                break
              case GL_BOOL:
                checkType('boolean');
                break
              case GL_BOOL_VEC2:
                checkVector(2);
                break
              case GL_BOOL_VEC3:
                checkVector(3);
                break
              case GL_BOOL_VEC4:
                checkVector(4);
                break
              case GL_FLOAT_MAT2:
                checkVector(4);
                break
              case GL_FLOAT_MAT3:
                checkVector(9);
                break
              case GL_FLOAT_MAT4:
                checkVector(16);
                break
              case GL_SAMPLER_2D:
                checkTexture(GL_TEXTURE_2D$3);
                break
              case GL_SAMPLER_CUBE:
                checkTexture(GL_TEXTURE_CUBE_MAP$2);
                break
            }
          });

          var unroll = 1;
          switch (type) {
            case GL_SAMPLER_2D:
            case GL_SAMPLER_CUBE:
              var TEX = scope.def(VALUE, '._texture');
              scope(GL, '.uniform1i(', LOCATION, ',', TEX, '.bind());');
              scope.exit(TEX, '.unbind();');
              continue

            case GL_INT$3:
            case GL_BOOL:
              infix = '1i';
              break

            case GL_INT_VEC2:
            case GL_BOOL_VEC2:
              infix = '2i';
              unroll = 2;
              break

            case GL_INT_VEC3:
            case GL_BOOL_VEC3:
              infix = '3i';
              unroll = 3;
              break

            case GL_INT_VEC4:
            case GL_BOOL_VEC4:
              infix = '4i';
              unroll = 4;
              break

            case GL_FLOAT$8:
              infix = '1f';
              break

            case GL_FLOAT_VEC2:
              infix = '2f';
              unroll = 2;
              break

            case GL_FLOAT_VEC3:
              infix = '3f';
              unroll = 3;
              break

            case GL_FLOAT_VEC4:
              infix = '4f';
              unroll = 4;
              break

            case GL_FLOAT_MAT2:
              infix = 'Matrix2fv';
              break

            case GL_FLOAT_MAT3:
              infix = 'Matrix3fv';
              break

            case GL_FLOAT_MAT4:
              infix = 'Matrix4fv';
              break
          }

          scope(GL, '.uniform', infix, '(', LOCATION, ',');
          if (infix.charAt(0) === 'M') {
            var matSize = Math.pow(type - GL_FLOAT_MAT2 + 2, 2);
            var STORAGE = env.global.def('new Float32Array(', matSize, ')');
            if (Array.isArray(VALUE)) {
              scope(
                'false,(',
                loop(matSize, function (i) {
                  return STORAGE + '[' + i + ']=' + VALUE[i]
                }), ',', STORAGE, ')');
            } else {
              scope(
                'false,(Array.isArray(', VALUE, ')||', VALUE, ' instanceof Float32Array)?', VALUE, ':(',
                loop(matSize, function (i) {
                  return STORAGE + '[' + i + ']=' + VALUE + '[' + i + ']'
                }), ',', STORAGE, ')');
            }
          } else if (unroll > 1) {
            scope(loop(unroll, function (i) {
              return Array.isArray(VALUE) ? VALUE[i] : VALUE + '[' + i + ']'
            }));
          } else {
            check$1(!Array.isArray(VALUE), 'uniform value must not be an array');
            scope(VALUE);
          }
          scope(');');
        }
      }

      function emitDraw (env, outer, inner, args) {
        var shared = env.shared;
        var GL = shared.gl;
        var DRAW_STATE = shared.draw;

        var drawOptions = args.draw;

        function emitElements () {
          var defn = drawOptions.elements;
          var ELEMENTS;
          var scope = outer;
          if (defn) {
            if ((defn.contextDep && args.contextDynamic) || defn.propDep) {
              scope = inner;
            }
            ELEMENTS = defn.append(env, scope);
          } else {
            ELEMENTS = scope.def(DRAW_STATE, '.', S_ELEMENTS);
          }
          if (ELEMENTS) {
            scope(
              'if(' + ELEMENTS + ')' +
              GL + '.bindBuffer(' + GL_ELEMENT_ARRAY_BUFFER$1 + ',' + ELEMENTS + '.buffer.buffer);');
          }
          return ELEMENTS
        }

        function emitCount () {
          var defn = drawOptions.count;
          var COUNT;
          var scope = outer;
          if (defn) {
            if ((defn.contextDep && args.contextDynamic) || defn.propDep) {
              scope = inner;
            }
            COUNT = defn.append(env, scope);
            check$1.optional(function () {
              if (defn.MISSING) {
                env.assert(outer, 'false', 'missing vertex count');
              }
              if (defn.DYNAMIC) {
                env.assert(scope, COUNT + '>=0', 'missing vertex count');
              }
            });
          } else {
            COUNT = scope.def(DRAW_STATE, '.', S_COUNT);
            check$1.optional(function () {
              env.assert(scope, COUNT + '>=0', 'missing vertex count');
            });
          }
          return COUNT
        }

        var ELEMENTS = emitElements();
        function emitValue (name) {
          var defn = drawOptions[name];
          if (defn) {
            if ((defn.contextDep && args.contextDynamic) || defn.propDep) {
              return defn.append(env, inner)
            } else {
              return defn.append(env, outer)
            }
          } else {
            return outer.def(DRAW_STATE, '.', name)
          }
        }

        var PRIMITIVE = emitValue(S_PRIMITIVE);
        var OFFSET = emitValue(S_OFFSET);

        var COUNT = emitCount();
        if (typeof COUNT === 'number') {
          if (COUNT === 0) {
            return
          }
        } else {
          inner('if(', COUNT, '){');
          inner.exit('}');
        }

        var INSTANCES, EXT_INSTANCING;
        if (extInstancing) {
          INSTANCES = emitValue(S_INSTANCES);
          EXT_INSTANCING = env.instancing;
        }

        var ELEMENT_TYPE = ELEMENTS + '.type';

        var elementsStatic = drawOptions.elements && isStatic(drawOptions.elements);

        function emitInstancing () {
          function drawElements () {
            inner(EXT_INSTANCING, '.drawElementsInstancedANGLE(', [
              PRIMITIVE,
              COUNT,
              ELEMENT_TYPE,
              OFFSET + '<<((' + ELEMENT_TYPE + '-' + GL_UNSIGNED_BYTE$8 + ')>>1)',
              INSTANCES
            ], ');');
          }

          function drawArrays () {
            inner(EXT_INSTANCING, '.drawArraysInstancedANGLE(',
              [PRIMITIVE, OFFSET, COUNT, INSTANCES], ');');
          }

          if (ELEMENTS) {
            if (!elementsStatic) {
              inner('if(', ELEMENTS, '){');
              drawElements();
              inner('}else{');
              drawArrays();
              inner('}');
            } else {
              drawElements();
            }
          } else {
            drawArrays();
          }
        }

        function emitRegular () {
          function drawElements () {
            inner(GL + '.drawElements(' + [
              PRIMITIVE,
              COUNT,
              ELEMENT_TYPE,
              OFFSET + '<<((' + ELEMENT_TYPE + '-' + GL_UNSIGNED_BYTE$8 + ')>>1)'
            ] + ');');
          }

          function drawArrays () {
            inner(GL + '.drawArrays(' + [PRIMITIVE, OFFSET, COUNT] + ');');
          }

          if (ELEMENTS) {
            if (!elementsStatic) {
              inner('if(', ELEMENTS, '){');
              drawElements();
              inner('}else{');
              drawArrays();
              inner('}');
            } else {
              drawElements();
            }
          } else {
            drawArrays();
          }
        }

        if (extInstancing && (typeof INSTANCES !== 'number' || INSTANCES >= 0)) {
          if (typeof INSTANCES === 'string') {
            inner('if(', INSTANCES, '>0){');
            emitInstancing();
            inner('}else if(', INSTANCES, '<0){');
            emitRegular();
            inner('}');
          } else {
            emitInstancing();
          }
        } else {
          emitRegular();
        }
      }

      function createBody (emitBody, parentEnv, args, program, count) {
        var env = createREGLEnvironment();
        var scope = env.proc('body', count);
        check$1.optional(function () {
          env.commandStr = parentEnv.commandStr;
          env.command = env.link(parentEnv.commandStr);
        });
        if (extInstancing) {
          env.instancing = scope.def(
            env.shared.extensions, '.angle_instanced_arrays');
        }
        emitBody(env, scope, args, program);
        return env.compile().body
      }

      // ===================================================
      // ===================================================
      // DRAW PROC
      // ===================================================
      // ===================================================
      function emitDrawBody (env, draw, args, program) {
        injectExtensions(env, draw);
        if (args.useVAO) {
          if (args.drawVAO) {
            draw(env.shared.vao, '.setVAO(', args.drawVAO.append(env, draw), ');');
          } else {
            draw(env.shared.vao, '.setVAO(', env.shared.vao, '.targetVAO);');
          }
        } else {
          draw(env.shared.vao, '.setVAO(null);');
          emitAttributes(env, draw, args, program.attributes, function () {
            return true
          });
        }
        emitUniforms(env, draw, args, program.uniforms, function () {
          return true
        });
        emitDraw(env, draw, draw, args);
      }

      function emitDrawProc (env, args) {
        var draw = env.proc('draw', 1);

        injectExtensions(env, draw);

        emitContext(env, draw, args.context);
        emitPollFramebuffer(env, draw, args.framebuffer);

        emitPollState(env, draw, args);
        emitSetOptions(env, draw, args.state);

        emitProfile(env, draw, args, false, true);

        var program = args.shader.progVar.append(env, draw);
        draw(env.shared.gl, '.useProgram(', program, '.program);');

        if (args.shader.program) {
          emitDrawBody(env, draw, args, args.shader.program);
        } else {
          draw(env.shared.vao, '.setVAO(null);');
          var drawCache = env.global.def('{}');
          var PROG_ID = draw.def(program, '.id');
          var CACHED_PROC = draw.def(drawCache, '[', PROG_ID, ']');
          draw(
            env.cond(CACHED_PROC)
              .then(CACHED_PROC, '.call(this,a0);')
              .else(
                CACHED_PROC, '=', drawCache, '[', PROG_ID, ']=',
                env.link(function (program) {
                  return createBody(emitDrawBody, env, args, program, 1)
                }), '(', program, ');',
                CACHED_PROC, '.call(this,a0);'));
        }

        if (Object.keys(args.state).length > 0) {
          draw(env.shared.current, '.dirty=true;');
        }
      }

      // ===================================================
      // ===================================================
      // BATCH PROC
      // ===================================================
      // ===================================================

      function emitBatchDynamicShaderBody (env, scope, args, program) {
        env.batchId = 'a1';

        injectExtensions(env, scope);

        function all () {
          return true
        }

        emitAttributes(env, scope, args, program.attributes, all);
        emitUniforms(env, scope, args, program.uniforms, all);
        emitDraw(env, scope, scope, args);
      }

      function emitBatchBody (env, scope, args, program) {
        injectExtensions(env, scope);

        var contextDynamic = args.contextDep;

        var BATCH_ID = scope.def();
        var PROP_LIST = 'a0';
        var NUM_PROPS = 'a1';
        var PROPS = scope.def();
        env.shared.props = PROPS;
        env.batchId = BATCH_ID;

        var outer = env.scope();
        var inner = env.scope();

        scope(
          outer.entry,
          'for(', BATCH_ID, '=0;', BATCH_ID, '<', NUM_PROPS, ';++', BATCH_ID, '){',
          PROPS, '=', PROP_LIST, '[', BATCH_ID, '];',
          inner,
          '}',
          outer.exit);

        function isInnerDefn (defn) {
          return ((defn.contextDep && contextDynamic) || defn.propDep)
        }

        function isOuterDefn (defn) {
          return !isInnerDefn(defn)
        }

        if (args.needsContext) {
          emitContext(env, inner, args.context);
        }
        if (args.needsFramebuffer) {
          emitPollFramebuffer(env, inner, args.framebuffer);
        }
        emitSetOptions(env, inner, args.state, isInnerDefn);

        if (args.profile && isInnerDefn(args.profile)) {
          emitProfile(env, inner, args, false, true);
        }

        if (!program) {
          var progCache = env.global.def('{}');
          var PROGRAM = args.shader.progVar.append(env, inner);
          var PROG_ID = inner.def(PROGRAM, '.id');
          var CACHED_PROC = inner.def(progCache, '[', PROG_ID, ']');
          inner(
            env.shared.gl, '.useProgram(', PROGRAM, '.program);',
            'if(!', CACHED_PROC, '){',
            CACHED_PROC, '=', progCache, '[', PROG_ID, ']=',
            env.link(function (program) {
              return createBody(
                emitBatchDynamicShaderBody, env, args, program, 2)
            }), '(', PROGRAM, ');}',
            CACHED_PROC, '.call(this,a0[', BATCH_ID, '],', BATCH_ID, ');');
        } else {
          if (args.useVAO) {
            if (args.drawVAO) {
              if (isInnerDefn(args.drawVAO)) {
                // vao is a prop
                inner(env.shared.vao, '.setVAO(', args.drawVAO.append(env, inner), ');');
              } else {
                // vao is invariant
                outer(env.shared.vao, '.setVAO(', args.drawVAO.append(env, outer), ');');
              }
            } else {
              // scoped vao binding
              outer(env.shared.vao, '.setVAO(', env.shared.vao, '.targetVAO);');
            }
          } else {
            outer(env.shared.vao, '.setVAO(null);');
            emitAttributes(env, outer, args, program.attributes, isOuterDefn);
            emitAttributes(env, inner, args, program.attributes, isInnerDefn);
          }
          emitUniforms(env, outer, args, program.uniforms, isOuterDefn);
          emitUniforms(env, inner, args, program.uniforms, isInnerDefn);
          emitDraw(env, outer, inner, args);
        }
      }

      function emitBatchProc (env, args) {
        var batch = env.proc('batch', 2);
        env.batchId = '0';

        injectExtensions(env, batch);

        // Check if any context variables depend on props
        var contextDynamic = false;
        var needsContext = true;
        Object.keys(args.context).forEach(function (name) {
          contextDynamic = contextDynamic || args.context[name].propDep;
        });
        if (!contextDynamic) {
          emitContext(env, batch, args.context);
          needsContext = false;
        }

        // framebuffer state affects framebufferWidth/height context vars
        var framebuffer = args.framebuffer;
        var needsFramebuffer = false;
        if (framebuffer) {
          if (framebuffer.propDep) {
            contextDynamic = needsFramebuffer = true;
          } else if (framebuffer.contextDep && contextDynamic) {
            needsFramebuffer = true;
          }
          if (!needsFramebuffer) {
            emitPollFramebuffer(env, batch, framebuffer);
          }
        } else {
          emitPollFramebuffer(env, batch, null);
        }

        // viewport is weird because it can affect context vars
        if (args.state.viewport && args.state.viewport.propDep) {
          contextDynamic = true;
        }

        function isInnerDefn (defn) {
          return (defn.contextDep && contextDynamic) || defn.propDep
        }

        // set webgl options
        emitPollState(env, batch, args);
        emitSetOptions(env, batch, args.state, function (defn) {
          return !isInnerDefn(defn)
        });

        if (!args.profile || !isInnerDefn(args.profile)) {
          emitProfile(env, batch, args, false, 'a1');
        }

        // Save these values to args so that the batch body routine can use them
        args.contextDep = contextDynamic;
        args.needsContext = needsContext;
        args.needsFramebuffer = needsFramebuffer;

        // determine if shader is dynamic
        var progDefn = args.shader.progVar;
        if ((progDefn.contextDep && contextDynamic) || progDefn.propDep) {
          emitBatchBody(
            env,
            batch,
            args,
            null);
        } else {
          var PROGRAM = progDefn.append(env, batch);
          batch(env.shared.gl, '.useProgram(', PROGRAM, '.program);');
          if (args.shader.program) {
            emitBatchBody(
              env,
              batch,
              args,
              args.shader.program);
          } else {
            batch(env.shared.vao, '.setVAO(null);');
            var batchCache = env.global.def('{}');
            var PROG_ID = batch.def(PROGRAM, '.id');
            var CACHED_PROC = batch.def(batchCache, '[', PROG_ID, ']');
            batch(
              env.cond(CACHED_PROC)
                .then(CACHED_PROC, '.call(this,a0,a1);')
                .else(
                  CACHED_PROC, '=', batchCache, '[', PROG_ID, ']=',
                  env.link(function (program) {
                    return createBody(emitBatchBody, env, args, program, 2)
                  }), '(', PROGRAM, ');',
                  CACHED_PROC, '.call(this,a0,a1);'));
          }
        }

        if (Object.keys(args.state).length > 0) {
          batch(env.shared.current, '.dirty=true;');
        }
      }

      // ===================================================
      // ===================================================
      // SCOPE COMMAND
      // ===================================================
      // ===================================================
      function emitScopeProc (env, args) {
        var scope = env.proc('scope', 3);
        env.batchId = 'a2';

        var shared = env.shared;
        var CURRENT_STATE = shared.current;

        emitContext(env, scope, args.context);

        if (args.framebuffer) {
          args.framebuffer.append(env, scope);
        }

        sortState(Object.keys(args.state)).forEach(function (name) {
          var defn = args.state[name];
          var value = defn.append(env, scope);
          if (isArrayLike(value)) {
            value.forEach(function (v, i) {
              scope.set(env.next[name], '[' + i + ']', v);
            });
          } else {
            scope.set(shared.next, '.' + name, value);
          }
        });

        emitProfile(env, scope, args, true, true)

        ;[S_ELEMENTS, S_OFFSET, S_COUNT, S_INSTANCES, S_PRIMITIVE].forEach(
          function (opt) {
            var variable = args.draw[opt];
            if (!variable) {
              return
            }
            scope.set(shared.draw, '.' + opt, '' + variable.append(env, scope));
          });

        Object.keys(args.uniforms).forEach(function (opt) {
          var value = args.uniforms[opt].append(env, scope);
          if (Array.isArray(value)) {
            value = '[' + value.join() + ']';
          }
          scope.set(
            shared.uniforms,
            '[' + stringStore.id(opt) + ']',
            value);
        });

        Object.keys(args.attributes).forEach(function (name) {
          var record = args.attributes[name].append(env, scope);
          var scopeAttrib = env.scopeAttrib(name);
          Object.keys(new AttributeRecord()).forEach(function (prop) {
            scope.set(scopeAttrib, '.' + prop, record[prop]);
          });
        });

        if (args.scopeVAO) {
          scope.set(shared.vao, '.targetVAO', args.scopeVAO.append(env, scope));
        }

        function saveShader (name) {
          var shader = args.shader[name];
          if (shader) {
            scope.set(shared.shader, '.' + name, shader.append(env, scope));
          }
        }
        saveShader(S_VERT);
        saveShader(S_FRAG);

        if (Object.keys(args.state).length > 0) {
          scope(CURRENT_STATE, '.dirty=true;');
          scope.exit(CURRENT_STATE, '.dirty=true;');
        }

        scope('a1(', env.shared.context, ',a0,', env.batchId, ');');
      }

      function isDynamicObject (object) {
        if (typeof object !== 'object' || isArrayLike(object)) {
          return
        }
        var props = Object.keys(object);
        for (var i = 0; i < props.length; ++i) {
          if (dynamic.isDynamic(object[props[i]])) {
            return true
          }
        }
        return false
      }

      function splatObject (env, options, name) {
        var object = options.static[name];
        if (!object || !isDynamicObject(object)) {
          return
        }

        var globals = env.global;
        var keys = Object.keys(object);
        var thisDep = false;
        var contextDep = false;
        var propDep = false;
        var objectRef = env.global.def('{}');
        keys.forEach(function (key) {
          var value = object[key];
          if (dynamic.isDynamic(value)) {
            if (typeof value === 'function') {
              value = object[key] = dynamic.unbox(value);
            }
            var deps = createDynamicDecl(value, null);
            thisDep = thisDep || deps.thisDep;
            propDep = propDep || deps.propDep;
            contextDep = contextDep || deps.contextDep;
          } else {
            globals(objectRef, '.', key, '=');
            switch (typeof value) {
              case 'number':
                globals(value);
                break
              case 'string':
                globals('"', value, '"');
                break
              case 'object':
                if (Array.isArray(value)) {
                  globals('[', value.join(), ']');
                }
                break
              default:
                globals(env.link(value));
                break
            }
            globals(';');
          }
        });

        function appendBlock (env, block) {
          keys.forEach(function (key) {
            var value = object[key];
            if (!dynamic.isDynamic(value)) {
              return
            }
            var ref = env.invoke(block, value);
            block(objectRef, '.', key, '=', ref, ';');
          });
        }

        options.dynamic[name] = new dynamic.DynamicVariable(DYN_THUNK, {
          thisDep: thisDep,
          contextDep: contextDep,
          propDep: propDep,
          ref: objectRef,
          append: appendBlock
        });
        delete options.static[name];
      }

      // ===========================================================================
      // ===========================================================================
      // MAIN DRAW COMMAND
      // ===========================================================================
      // ===========================================================================
      function compileCommand (options, attributes, uniforms, context, stats) {
        var env = createREGLEnvironment();

        // link stats, so that we can easily access it in the program.
        env.stats = env.link(stats);

        // splat options and attributes to allow for dynamic nested properties
        Object.keys(attributes.static).forEach(function (key) {
          splatObject(env, attributes, key);
        });
        NESTED_OPTIONS.forEach(function (name) {
          splatObject(env, options, name);
        });

        var args = parseArguments(options, attributes, uniforms, context, env);

        emitDrawProc(env, args);
        emitScopeProc(env, args);
        emitBatchProc(env, args);

        return extend(env.compile(), {
          destroy: function () {
            args.shader.program.destroy();
          }
        })
      }

      // ===========================================================================
      // ===========================================================================
      // POLL / REFRESH
      // ===========================================================================
      // ===========================================================================
      return {
        next: nextState,
        current: currentState,
        procs: (function () {
          var env = createREGLEnvironment();
          var poll = env.proc('poll');
          var refresh = env.proc('refresh');
          var common = env.block();
          poll(common);
          refresh(common);

          var shared = env.shared;
          var GL = shared.gl;
          var NEXT_STATE = shared.next;
          var CURRENT_STATE = shared.current;

          common(CURRENT_STATE, '.dirty=false;');

          emitPollFramebuffer(env, poll);
          emitPollFramebuffer(env, refresh, null, true);

          // Refresh updates all attribute state changes
          var INSTANCING;
          if (extInstancing) {
            INSTANCING = env.link(extInstancing);
          }

          // update vertex array bindings
          if (extensions.oes_vertex_array_object) {
            refresh(env.link(extensions.oes_vertex_array_object), '.bindVertexArrayOES(null);');
          }
          for (var i = 0; i < limits.maxAttributes; ++i) {
            var BINDING = refresh.def(shared.attributes, '[', i, ']');
            var ifte = env.cond(BINDING, '.buffer');
            ifte.then(
              GL, '.enableVertexAttribArray(', i, ');',
              GL, '.bindBuffer(',
              GL_ARRAY_BUFFER$2, ',',
              BINDING, '.buffer.buffer);',
              GL, '.vertexAttribPointer(',
              i, ',',
              BINDING, '.size,',
              BINDING, '.type,',
              BINDING, '.normalized,',
              BINDING, '.stride,',
              BINDING, '.offset);'
            ).else(
              GL, '.disableVertexAttribArray(', i, ');',
              GL, '.vertexAttrib4f(',
              i, ',',
              BINDING, '.x,',
              BINDING, '.y,',
              BINDING, '.z,',
              BINDING, '.w);',
              BINDING, '.buffer=null;');
            refresh(ifte);
            if (extInstancing) {
              refresh(
                INSTANCING, '.vertexAttribDivisorANGLE(',
                i, ',',
                BINDING, '.divisor);');
            }
          }
          refresh(
            env.shared.vao, '.currentVAO=null;',
            env.shared.vao, '.setVAO(', env.shared.vao, '.targetVAO);');

          Object.keys(GL_FLAGS).forEach(function (flag) {
            var cap = GL_FLAGS[flag];
            var NEXT = common.def(NEXT_STATE, '.', flag);
            var block = env.block();
            block('if(', NEXT, '){',
              GL, '.enable(', cap, ')}else{',
              GL, '.disable(', cap, ')}',
              CURRENT_STATE, '.', flag, '=', NEXT, ';');
            refresh(block);
            poll(
              'if(', NEXT, '!==', CURRENT_STATE, '.', flag, '){',
              block,
              '}');
          });

          Object.keys(GL_VARIABLES).forEach(function (name) {
            var func = GL_VARIABLES[name];
            var init = currentState[name];
            var NEXT, CURRENT;
            var block = env.block();
            block(GL, '.', func, '(');
            if (isArrayLike(init)) {
              var n = init.length;
              NEXT = env.global.def(NEXT_STATE, '.', name);
              CURRENT = env.global.def(CURRENT_STATE, '.', name);
              block(
                loop(n, function (i) {
                  return NEXT + '[' + i + ']'
                }), ');',
                loop(n, function (i) {
                  return CURRENT + '[' + i + ']=' + NEXT + '[' + i + '];'
                }).join(''));
              poll(
                'if(', loop(n, function (i) {
                  return NEXT + '[' + i + ']!==' + CURRENT + '[' + i + ']'
                }).join('||'), '){',
                block,
                '}');
            } else {
              NEXT = common.def(NEXT_STATE, '.', name);
              CURRENT = common.def(CURRENT_STATE, '.', name);
              block(
                NEXT, ');',
                CURRENT_STATE, '.', name, '=', NEXT, ';');
              poll(
                'if(', NEXT, '!==', CURRENT, '){',
                block,
                '}');
            }
            refresh(block);
          });

          return env.compile()
        })(),
        compile: compileCommand
      }
    }

    function stats () {
      return {
        vaoCount: 0,
        bufferCount: 0,
        elementsCount: 0,
        framebufferCount: 0,
        shaderCount: 0,
        textureCount: 0,
        cubeCount: 0,
        renderbufferCount: 0,
        maxTextureUnits: 0
      }
    }

    var GL_QUERY_RESULT_EXT = 0x8866;
    var GL_QUERY_RESULT_AVAILABLE_EXT = 0x8867;
    var GL_TIME_ELAPSED_EXT = 0x88BF;

    var createTimer = function (gl, extensions) {
      if (!extensions.ext_disjoint_timer_query) {
        return null
      }

      // QUERY POOL BEGIN
      var queryPool = [];
      function allocQuery () {
        return queryPool.pop() || extensions.ext_disjoint_timer_query.createQueryEXT()
      }
      function freeQuery (query) {
        queryPool.push(query);
      }
      // QUERY POOL END

      var pendingQueries = [];
      function beginQuery (stats) {
        var query = allocQuery();
        extensions.ext_disjoint_timer_query.beginQueryEXT(GL_TIME_ELAPSED_EXT, query);
        pendingQueries.push(query);
        pushScopeStats(pendingQueries.length - 1, pendingQueries.length, stats);
      }

      function endQuery () {
        extensions.ext_disjoint_timer_query.endQueryEXT(GL_TIME_ELAPSED_EXT);
      }

      //
      // Pending stats pool.
      //
      function PendingStats () {
        this.startQueryIndex = -1;
        this.endQueryIndex = -1;
        this.sum = 0;
        this.stats = null;
      }
      var pendingStatsPool = [];
      function allocPendingStats () {
        return pendingStatsPool.pop() || new PendingStats()
      }
      function freePendingStats (pendingStats) {
        pendingStatsPool.push(pendingStats);
      }
      // Pending stats pool end

      var pendingStats = [];
      function pushScopeStats (start, end, stats) {
        var ps = allocPendingStats();
        ps.startQueryIndex = start;
        ps.endQueryIndex = end;
        ps.sum = 0;
        ps.stats = stats;
        pendingStats.push(ps);
      }

      // we should call this at the beginning of the frame,
      // in order to update gpuTime
      var timeSum = [];
      var queryPtr = [];
      function update () {
        var ptr, i;

        var n = pendingQueries.length;
        if (n === 0) {
          return
        }

        // Reserve space
        queryPtr.length = Math.max(queryPtr.length, n + 1);
        timeSum.length = Math.max(timeSum.length, n + 1);
        timeSum[0] = 0;
        queryPtr[0] = 0;

        // Update all pending timer queries
        var queryTime = 0;
        ptr = 0;
        for (i = 0; i < pendingQueries.length; ++i) {
          var query = pendingQueries[i];
          if (extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_AVAILABLE_EXT)) {
            queryTime += extensions.ext_disjoint_timer_query.getQueryObjectEXT(query, GL_QUERY_RESULT_EXT);
            freeQuery(query);
          } else {
            pendingQueries[ptr++] = query;
          }
          timeSum[i + 1] = queryTime;
          queryPtr[i + 1] = ptr;
        }
        pendingQueries.length = ptr;

        // Update all pending stat queries
        ptr = 0;
        for (i = 0; i < pendingStats.length; ++i) {
          var stats = pendingStats[i];
          var start = stats.startQueryIndex;
          var end = stats.endQueryIndex;
          stats.sum += timeSum[end] - timeSum[start];
          var startPtr = queryPtr[start];
          var endPtr = queryPtr[end];
          if (endPtr === startPtr) {
            stats.stats.gpuTime += stats.sum / 1e6;
            freePendingStats(stats);
          } else {
            stats.startQueryIndex = startPtr;
            stats.endQueryIndex = endPtr;
            pendingStats[ptr++] = stats;
          }
        }
        pendingStats.length = ptr;
      }

      return {
        beginQuery: beginQuery,
        endQuery: endQuery,
        pushScopeStats: pushScopeStats,
        update: update,
        getNumPendingQueries: function () {
          return pendingQueries.length
        },
        clear: function () {
          queryPool.push.apply(queryPool, pendingQueries);
          for (var i = 0; i < queryPool.length; i++) {
            extensions.ext_disjoint_timer_query.deleteQueryEXT(queryPool[i]);
          }
          pendingQueries.length = 0;
          queryPool.length = 0;
        },
        restore: function () {
          pendingQueries.length = 0;
          queryPool.length = 0;
        }
      }
    };

    var GL_COLOR_BUFFER_BIT = 16384;
    var GL_DEPTH_BUFFER_BIT = 256;
    var GL_STENCIL_BUFFER_BIT = 1024;

    var GL_ARRAY_BUFFER = 34962;

    var CONTEXT_LOST_EVENT = 'webglcontextlost';
    var CONTEXT_RESTORED_EVENT = 'webglcontextrestored';

    var DYN_PROP = 1;
    var DYN_CONTEXT = 2;
    var DYN_STATE = 3;

    function find (haystack, needle) {
      for (var i = 0; i < haystack.length; ++i) {
        if (haystack[i] === needle) {
          return i
        }
      }
      return -1
    }

    function wrapREGL (args) {
      var config = parseArgs(args);
      if (!config) {
        return null
      }

      var gl = config.gl;
      var glAttributes = gl.getContextAttributes();
      var contextLost = gl.isContextLost();

      var extensionState = createExtensionCache(gl, config);
      if (!extensionState) {
        return null
      }

      var stringStore = createStringStore();
      var stats$$1 = stats();
      var extensions = extensionState.extensions;
      var timer = createTimer(gl, extensions);

      var START_TIME = clock();
      var WIDTH = gl.drawingBufferWidth;
      var HEIGHT = gl.drawingBufferHeight;

      var contextState = {
        tick: 0,
        time: 0,
        viewportWidth: WIDTH,
        viewportHeight: HEIGHT,
        framebufferWidth: WIDTH,
        framebufferHeight: HEIGHT,
        drawingBufferWidth: WIDTH,
        drawingBufferHeight: HEIGHT,
        pixelRatio: config.pixelRatio
      };
      var uniformState = {};
      var drawState = {
        elements: null,
        primitive: 4, // GL_TRIANGLES
        count: -1,
        offset: 0,
        instances: -1
      };

      var limits = wrapLimits(gl, extensions);
      var bufferState = wrapBufferState(
        gl,
        stats$$1,
        config,
        destroyBuffer);
      var attributeState = wrapAttributeState(
        gl,
        extensions,
        limits,
        stats$$1,
        bufferState);
      function destroyBuffer (buffer) {
        return attributeState.destroyBuffer(buffer)
      }
      var elementState = wrapElementsState(gl, extensions, bufferState, stats$$1);
      var shaderState = wrapShaderState(gl, stringStore, stats$$1, config);
      var textureState = createTextureSet(
        gl,
        extensions,
        limits,
        function () { core.procs.poll(); },
        contextState,
        stats$$1,
        config);
      var renderbufferState = wrapRenderbuffers(gl, extensions, limits, stats$$1, config);
      var framebufferState = wrapFBOState(
        gl,
        extensions,
        limits,
        textureState,
        renderbufferState,
        stats$$1);
      var core = reglCore(
        gl,
        stringStore,
        extensions,
        limits,
        bufferState,
        elementState,
        textureState,
        framebufferState,
        uniformState,
        attributeState,
        shaderState,
        drawState,
        contextState,
        timer,
        config);
      var readPixels = wrapReadPixels(
        gl,
        framebufferState,
        core.procs.poll,
        contextState,
        glAttributes, extensions, limits);

      var nextState = core.next;
      var canvas = gl.canvas;

      var rafCallbacks = [];
      var lossCallbacks = [];
      var restoreCallbacks = [];
      var destroyCallbacks = [config.onDestroy];

      var activeRAF = null;
      function handleRAF () {
        if (rafCallbacks.length === 0) {
          if (timer) {
            timer.update();
          }
          activeRAF = null;
          return
        }

        // schedule next animation frame
        activeRAF = raf.next(handleRAF);

        // poll for changes
        poll();

        // fire a callback for all pending rafs
        for (var i = rafCallbacks.length - 1; i >= 0; --i) {
          var cb = rafCallbacks[i];
          if (cb) {
            cb(contextState, null, 0);
          }
        }

        // flush all pending webgl calls
        gl.flush();

        // poll GPU timers *after* gl.flush so we don't delay command dispatch
        if (timer) {
          timer.update();
        }
      }

      function startRAF () {
        if (!activeRAF && rafCallbacks.length > 0) {
          activeRAF = raf.next(handleRAF);
        }
      }

      function stopRAF () {
        if (activeRAF) {
          raf.cancel(handleRAF);
          activeRAF = null;
        }
      }

      function handleContextLoss (event) {
        event.preventDefault();

        // set context lost flag
        contextLost = true;

        // pause request animation frame
        stopRAF();

        // lose context
        lossCallbacks.forEach(function (cb) {
          cb();
        });
      }

      function handleContextRestored (event) {
        // clear error code
        gl.getError();

        // clear context lost flag
        contextLost = false;

        // refresh state
        extensionState.restore();
        shaderState.restore();
        bufferState.restore();
        textureState.restore();
        renderbufferState.restore();
        framebufferState.restore();
        attributeState.restore();
        if (timer) {
          timer.restore();
        }

        // refresh state
        core.procs.refresh();

        // restart RAF
        startRAF();

        // restore context
        restoreCallbacks.forEach(function (cb) {
          cb();
        });
      }

      if (canvas) {
        canvas.addEventListener(CONTEXT_LOST_EVENT, handleContextLoss, false);
        canvas.addEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored, false);
      }

      function destroy () {
        rafCallbacks.length = 0;
        stopRAF();

        if (canvas) {
          canvas.removeEventListener(CONTEXT_LOST_EVENT, handleContextLoss);
          canvas.removeEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored);
        }

        shaderState.clear();
        framebufferState.clear();
        renderbufferState.clear();
        textureState.clear();
        elementState.clear();
        bufferState.clear();
        attributeState.clear();

        if (timer) {
          timer.clear();
        }

        destroyCallbacks.forEach(function (cb) {
          cb();
        });
      }

      function compileProcedure (options) {
        check$1(!!options, 'invalid args to regl({...})');
        check$1.type(options, 'object', 'invalid args to regl({...})');

        function flattenNestedOptions (options) {
          var result = extend({}, options);
          delete result.uniforms;
          delete result.attributes;
          delete result.context;
          delete result.vao;

          if ('stencil' in result && result.stencil.op) {
            result.stencil.opBack = result.stencil.opFront = result.stencil.op;
            delete result.stencil.op;
          }

          function merge (name) {
            if (name in result) {
              var child = result[name];
              delete result[name];
              Object.keys(child).forEach(function (prop) {
                result[name + '.' + prop] = child[prop];
              });
            }
          }
          merge('blend');
          merge('depth');
          merge('cull');
          merge('stencil');
          merge('polygonOffset');
          merge('scissor');
          merge('sample');

          if ('vao' in options) {
            result.vao = options.vao;
          }

          return result
        }

        function separateDynamic (object, useArrays) {
          var staticItems = {};
          var dynamicItems = {};
          Object.keys(object).forEach(function (option) {
            var value = object[option];
            if (dynamic.isDynamic(value)) {
              dynamicItems[option] = dynamic.unbox(value, option);
              return
            } else if (useArrays && Array.isArray(value)) {
              for (var i = 0; i < value.length; ++i) {
                if (dynamic.isDynamic(value[i])) {
                  dynamicItems[option] = dynamic.unbox(value, option);
                  return
                }
              }
            }
            staticItems[option] = value;
          });
          return {
            dynamic: dynamicItems,
            static: staticItems
          }
        }

        // Treat context variables separate from other dynamic variables
        var context = separateDynamic(options.context || {}, true);
        var uniforms = separateDynamic(options.uniforms || {}, true);
        var attributes = separateDynamic(options.attributes || {}, false);
        var opts = separateDynamic(flattenNestedOptions(options), false);

        var stats$$1 = {
          gpuTime: 0.0,
          cpuTime: 0.0,
          count: 0
        };

        var compiled = core.compile(opts, attributes, uniforms, context, stats$$1);

        var draw = compiled.draw;
        var batch = compiled.batch;
        var scope = compiled.scope;

        // FIXME: we should modify code generation for batch commands so this
        // isn't necessary
        var EMPTY_ARRAY = [];
        function reserve (count) {
          while (EMPTY_ARRAY.length < count) {
            EMPTY_ARRAY.push(null);
          }
          return EMPTY_ARRAY
        }

        function REGLCommand (args, body) {
          var i;
          if (contextLost) {
            check$1.raise('context lost');
          }
          if (typeof args === 'function') {
            return scope.call(this, null, args, 0)
          } else if (typeof body === 'function') {
            if (typeof args === 'number') {
              for (i = 0; i < args; ++i) {
                scope.call(this, null, body, i);
              }
            } else if (Array.isArray(args)) {
              for (i = 0; i < args.length; ++i) {
                scope.call(this, args[i], body, i);
              }
            } else {
              return scope.call(this, args, body, 0)
            }
          } else if (typeof args === 'number') {
            if (args > 0) {
              return batch.call(this, reserve(args | 0), args | 0)
            }
          } else if (Array.isArray(args)) {
            if (args.length) {
              return batch.call(this, args, args.length)
            }
          } else {
            return draw.call(this, args)
          }
        }

        return extend(REGLCommand, {
          stats: stats$$1,
          destroy: function () {
            compiled.destroy();
          }
        })
      }

      var setFBO = framebufferState.setFBO = compileProcedure({
        framebuffer: dynamic.define.call(null, DYN_PROP, 'framebuffer')
      });

      function clearImpl (_, options) {
        var clearFlags = 0;
        core.procs.poll();

        var c = options.color;
        if (c) {
          gl.clearColor(+c[0] || 0, +c[1] || 0, +c[2] || 0, +c[3] || 0);
          clearFlags |= GL_COLOR_BUFFER_BIT;
        }
        if ('depth' in options) {
          gl.clearDepth(+options.depth);
          clearFlags |= GL_DEPTH_BUFFER_BIT;
        }
        if ('stencil' in options) {
          gl.clearStencil(options.stencil | 0);
          clearFlags |= GL_STENCIL_BUFFER_BIT;
        }

        check$1(!!clearFlags, 'called regl.clear with no buffer specified');
        gl.clear(clearFlags);
      }

      function clear (options) {
        check$1(
          typeof options === 'object' && options,
          'regl.clear() takes an object as input');
        if ('framebuffer' in options) {
          if (options.framebuffer &&
              options.framebuffer_reglType === 'framebufferCube') {
            for (var i = 0; i < 6; ++i) {
              setFBO(extend({
                framebuffer: options.framebuffer.faces[i]
              }, options), clearImpl);
            }
          } else {
            setFBO(options, clearImpl);
          }
        } else {
          clearImpl(null, options);
        }
      }

      function frame (cb) {
        check$1.type(cb, 'function', 'regl.frame() callback must be a function');
        rafCallbacks.push(cb);

        function cancel () {
          // FIXME:  should we check something other than equals cb here?
          // what if a user calls frame twice with the same callback...
          //
          var i = find(rafCallbacks, cb);
          check$1(i >= 0, 'cannot cancel a frame twice');
          function pendingCancel () {
            var index = find(rafCallbacks, pendingCancel);
            rafCallbacks[index] = rafCallbacks[rafCallbacks.length - 1];
            rafCallbacks.length -= 1;
            if (rafCallbacks.length <= 0) {
              stopRAF();
            }
          }
          rafCallbacks[i] = pendingCancel;
        }

        startRAF();

        return {
          cancel: cancel
        }
      }

      // poll viewport
      function pollViewport () {
        var viewport = nextState.viewport;
        var scissorBox = nextState.scissor_box;
        viewport[0] = viewport[1] = scissorBox[0] = scissorBox[1] = 0;
        contextState.viewportWidth =
          contextState.framebufferWidth =
          contextState.drawingBufferWidth =
          viewport[2] =
          scissorBox[2] = gl.drawingBufferWidth;
        contextState.viewportHeight =
          contextState.framebufferHeight =
          contextState.drawingBufferHeight =
          viewport[3] =
          scissorBox[3] = gl.drawingBufferHeight;
      }

      function poll () {
        contextState.tick += 1;
        contextState.time = now();
        pollViewport();
        core.procs.poll();
      }

      function refresh () {
        textureState.refresh();
        pollViewport();
        core.procs.refresh();
        if (timer) {
          timer.update();
        }
      }

      function now () {
        return (clock() - START_TIME) / 1000.0
      }

      refresh();

      function addListener (event, callback) {
        check$1.type(callback, 'function', 'listener callback must be a function');

        var callbacks;
        switch (event) {
          case 'frame':
            return frame(callback)
          case 'lost':
            callbacks = lossCallbacks;
            break
          case 'restore':
            callbacks = restoreCallbacks;
            break
          case 'destroy':
            callbacks = destroyCallbacks;
            break
          default:
            check$1.raise('invalid event, must be one of frame,lost,restore,destroy');
        }

        callbacks.push(callback);
        return {
          cancel: function () {
            for (var i = 0; i < callbacks.length; ++i) {
              if (callbacks[i] === callback) {
                callbacks[i] = callbacks[callbacks.length - 1];
                callbacks.pop();
                return
              }
            }
          }
        }
      }

      var regl = extend(compileProcedure, {
        // Clear current FBO
        clear: clear,

        // Short cuts for dynamic variables
        prop: dynamic.define.bind(null, DYN_PROP),
        context: dynamic.define.bind(null, DYN_CONTEXT),
        this: dynamic.define.bind(null, DYN_STATE),

        // executes an empty draw command
        draw: compileProcedure({}),

        // Resources
        buffer: function (options) {
          return bufferState.create(options, GL_ARRAY_BUFFER, false, false)
        },
        elements: function (options) {
          return elementState.create(options, false)
        },
        texture: textureState.create2D,
        cube: textureState.createCube,
        renderbuffer: renderbufferState.create,
        framebuffer: framebufferState.create,
        framebufferCube: framebufferState.createCube,
        vao: attributeState.createVAO,

        // Expose context attributes
        attributes: glAttributes,

        // Frame rendering
        frame: frame,
        on: addListener,

        // System limits
        limits: limits,
        hasExtension: function (name) {
          return limits.extensions.indexOf(name.toLowerCase()) >= 0
        },

        // Read pixels
        read: readPixels,

        // Destroy regl and all associated resources
        destroy: destroy,

        // Direct GL state manipulation
        _gl: gl,
        _refresh: refresh,

        poll: function () {
          poll();
          if (timer) {
            timer.update();
          }
        },

        // Current time
        now: now,

        // regl Statistics Information
        stats: stats$$1
      });

      config.onDone(null, regl);

      return regl
    }

    return wrapREGL;

    })));

    });

    // Copyright 2019-2023 Tauri Programme within The Commons Conservancy
    // SPDX-License-Identifier: Apache-2.0
    // SPDX-License-Identifier: MIT
    /**
     * Open a file/directory selection dialog.
     *
     * The selected paths are added to the filesystem and asset protocol scopes.
     * When security is more important than the easy of use of this API,
     * prefer writing a dedicated command instead.
     *
     * Note that the scope change is not persisted, so the values are cleared when the application is restarted.
     * You can save it to the filesystem using [tauri-plugin-persisted-scope](https://github.com/tauri-apps/tauri-plugin-persisted-scope).
     * @example
     * ```typescript
     * import { open } from '@tauri-apps/plugin-dialog';
     * // Open a selection dialog for image files
     * const selected = await open({
     *   multiple: true,
     *   filters: [{
     *     name: 'Image',
     *     extensions: ['png', 'jpeg']
     *   }]
     * });
     * if (Array.isArray(selected)) {
     *   // user selected multiple files
     * } else if (selected === null) {
     *   // user cancelled the selection
     * } else {
     *   // user selected a single file
     * }
     * ```
     *
     * @example
     * ```typescript
     * import { open } from '@tauri-apps/plugin-dialog';
     * import { appDir } from '@tauri-apps/api/path';
     * // Open a selection dialog for directories
     * const selected = await open({
     *   directory: true,
     *   multiple: true,
     *   defaultPath: await appDir(),
     * });
     * if (Array.isArray(selected)) {
     *   // user selected multiple directories
     * } else if (selected === null) {
     *   // user cancelled the selection
     * } else {
     *   // user selected a single directory
     * }
     * ```
     *
     * @returns A promise resolving to the selected path(s)
     *
     * @since 2.0.0
     */
    async function open(options = {}) {
        if (typeof options === 'object') {
            Object.freeze(options);
        }
        return await invoke('plugin:dialog|open', { options });
    }
    /**
     * Open a file/directory save dialog.
     *
     * The selected path is added to the filesystem and asset protocol scopes.
     * When security is more important than the easy of use of this API,
     * prefer writing a dedicated command instead.
     *
     * Note that the scope change is not persisted, so the values are cleared when the application is restarted.
     * You can save it to the filesystem using [tauri-plugin-persisted-scope](https://github.com/tauri-apps/tauri-plugin-persisted-scope).
     * @example
     * ```typescript
     * import { save } from '@tauri-apps/plugin-dialog';
     * const filePath = await save({
     *   filters: [{
     *     name: 'Image',
     *     extensions: ['png', 'jpeg']
     *   }]
     * });
     * ```
     *
     * @returns A promise resolving to the selected path.
     *
     * @since 2.0.0
     */
    async function save(options = {}) {
        if (typeof options === 'object') {
            Object.freeze(options);
        }
        return await invoke('plugin:dialog|save', { options });
    }

    /*! js-yaml 4.1.0 https://github.com/nodeca/js-yaml @license MIT */
    function isNothing(subject) {
      return (typeof subject === 'undefined') || (subject === null);
    }


    function isObject(subject) {
      return (typeof subject === 'object') && (subject !== null);
    }


    function toArray(sequence) {
      if (Array.isArray(sequence)) return sequence;
      else if (isNothing(sequence)) return [];

      return [ sequence ];
    }


    function extend(target, source) {
      var index, length, key, sourceKeys;

      if (source) {
        sourceKeys = Object.keys(source);

        for (index = 0, length = sourceKeys.length; index < length; index += 1) {
          key = sourceKeys[index];
          target[key] = source[key];
        }
      }

      return target;
    }


    function repeat(string, count) {
      var result = '', cycle;

      for (cycle = 0; cycle < count; cycle += 1) {
        result += string;
      }

      return result;
    }


    function isNegativeZero(number) {
      return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
    }


    var isNothing_1      = isNothing;
    var isObject_1       = isObject;
    var toArray_1        = toArray;
    var repeat_1         = repeat;
    var isNegativeZero_1 = isNegativeZero;
    var extend_1         = extend;

    var common = {
    	isNothing: isNothing_1,
    	isObject: isObject_1,
    	toArray: toArray_1,
    	repeat: repeat_1,
    	isNegativeZero: isNegativeZero_1,
    	extend: extend_1
    };

    // YAML error class. http://stackoverflow.com/questions/8458984


    function formatError(exception, compact) {
      var where = '', message = exception.reason || '(unknown reason)';

      if (!exception.mark) return message;

      if (exception.mark.name) {
        where += 'in "' + exception.mark.name + '" ';
      }

      where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';

      if (!compact && exception.mark.snippet) {
        where += '\n\n' + exception.mark.snippet;
      }

      return message + ' ' + where;
    }


    function YAMLException$1(reason, mark) {
      // Super constructor
      Error.call(this);

      this.name = 'YAMLException';
      this.reason = reason;
      this.mark = mark;
      this.message = formatError(this, false);

      // Include stack trace in error object
      if (Error.captureStackTrace) {
        // Chrome and NodeJS
        Error.captureStackTrace(this, this.constructor);
      } else {
        // FF, IE 10+ and Safari 6+. Fallback for others
        this.stack = (new Error()).stack || '';
      }
    }


    // Inherit from Error
    YAMLException$1.prototype = Object.create(Error.prototype);
    YAMLException$1.prototype.constructor = YAMLException$1;


    YAMLException$1.prototype.toString = function toString(compact) {
      return this.name + ': ' + formatError(this, compact);
    };


    var exception = YAMLException$1;

    // get snippet for a single line, respecting maxLength
    function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
      var head = '';
      var tail = '';
      var maxHalfLength = Math.floor(maxLineLength / 2) - 1;

      if (position - lineStart > maxHalfLength) {
        head = ' ... ';
        lineStart = position - maxHalfLength + head.length;
      }

      if (lineEnd - position > maxHalfLength) {
        tail = ' ...';
        lineEnd = position + maxHalfLength - tail.length;
      }

      return {
        str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '→') + tail,
        pos: position - lineStart + head.length // relative position
      };
    }


    function padStart(string, max) {
      return common.repeat(' ', max - string.length) + string;
    }


    function makeSnippet(mark, options) {
      options = Object.create(options || null);

      if (!mark.buffer) return null;

      if (!options.maxLength) options.maxLength = 79;
      if (typeof options.indent      !== 'number') options.indent      = 1;
      if (typeof options.linesBefore !== 'number') options.linesBefore = 3;
      if (typeof options.linesAfter  !== 'number') options.linesAfter  = 2;

      var re = /\r?\n|\r|\0/g;
      var lineStarts = [ 0 ];
      var lineEnds = [];
      var match;
      var foundLineNo = -1;

      while ((match = re.exec(mark.buffer))) {
        lineEnds.push(match.index);
        lineStarts.push(match.index + match[0].length);

        if (mark.position <= match.index && foundLineNo < 0) {
          foundLineNo = lineStarts.length - 2;
        }
      }

      if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;

      var result = '', i, line;
      var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
      var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);

      for (i = 1; i <= options.linesBefore; i++) {
        if (foundLineNo - i < 0) break;
        line = getLine(
          mark.buffer,
          lineStarts[foundLineNo - i],
          lineEnds[foundLineNo - i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
          maxLineLength
        );
        result = common.repeat(' ', options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) +
          ' | ' + line.str + '\n' + result;
      }

      line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
      result += common.repeat(' ', options.indent) + padStart((mark.line + 1).toString(), lineNoLength) +
        ' | ' + line.str + '\n';
      result += common.repeat('-', options.indent + lineNoLength + 3 + line.pos) + '^' + '\n';

      for (i = 1; i <= options.linesAfter; i++) {
        if (foundLineNo + i >= lineEnds.length) break;
        line = getLine(
          mark.buffer,
          lineStarts[foundLineNo + i],
          lineEnds[foundLineNo + i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
          maxLineLength
        );
        result += common.repeat(' ', options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) +
          ' | ' + line.str + '\n';
      }

      return result.replace(/\n$/, '');
    }


    var snippet = makeSnippet;

    var TYPE_CONSTRUCTOR_OPTIONS = [
      'kind',
      'multi',
      'resolve',
      'construct',
      'instanceOf',
      'predicate',
      'represent',
      'representName',
      'defaultStyle',
      'styleAliases'
    ];

    var YAML_NODE_KINDS = [
      'scalar',
      'sequence',
      'mapping'
    ];

    function compileStyleAliases(map) {
      var result = {};

      if (map !== null) {
        Object.keys(map).forEach(function (style) {
          map[style].forEach(function (alias) {
            result[String(alias)] = style;
          });
        });
      }

      return result;
    }

    function Type$1(tag, options) {
      options = options || {};

      Object.keys(options).forEach(function (name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
          throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
        }
      });

      // TODO: Add tag format check.
      this.options       = options; // keep original options in case user wants to extend this type later
      this.tag           = tag;
      this.kind          = options['kind']          || null;
      this.resolve       = options['resolve']       || function () { return true; };
      this.construct     = options['construct']     || function (data) { return data; };
      this.instanceOf    = options['instanceOf']    || null;
      this.predicate     = options['predicate']     || null;
      this.represent     = options['represent']     || null;
      this.representName = options['representName'] || null;
      this.defaultStyle  = options['defaultStyle']  || null;
      this.multi         = options['multi']         || false;
      this.styleAliases  = compileStyleAliases(options['styleAliases'] || null);

      if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
      }
    }

    var type = Type$1;

    /*eslint-disable max-len*/





    function compileList(schema, name) {
      var result = [];

      schema[name].forEach(function (currentType) {
        var newIndex = result.length;

        result.forEach(function (previousType, previousIndex) {
          if (previousType.tag === currentType.tag &&
              previousType.kind === currentType.kind &&
              previousType.multi === currentType.multi) {

            newIndex = previousIndex;
          }
        });

        result[newIndex] = currentType;
      });

      return result;
    }


    function compileMap(/* lists... */) {
      var result = {
            scalar: {},
            sequence: {},
            mapping: {},
            fallback: {},
            multi: {
              scalar: [],
              sequence: [],
              mapping: [],
              fallback: []
            }
          }, index, length;

      function collectType(type) {
        if (type.multi) {
          result.multi[type.kind].push(type);
          result.multi['fallback'].push(type);
        } else {
          result[type.kind][type.tag] = result['fallback'][type.tag] = type;
        }
      }

      for (index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
      }
      return result;
    }


    function Schema$1(definition) {
      return this.extend(definition);
    }


    Schema$1.prototype.extend = function extend(definition) {
      var implicit = [];
      var explicit = [];

      if (definition instanceof type) {
        // Schema.extend(type)
        explicit.push(definition);

      } else if (Array.isArray(definition)) {
        // Schema.extend([ type1, type2, ... ])
        explicit = explicit.concat(definition);

      } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
        // Schema.extend({ explicit: [ type1, type2, ... ], implicit: [ type1, type2, ... ] })
        if (definition.implicit) implicit = implicit.concat(definition.implicit);
        if (definition.explicit) explicit = explicit.concat(definition.explicit);

      } else {
        throw new exception('Schema.extend argument should be a Type, [ Type ], ' +
          'or a schema definition ({ implicit: [...], explicit: [...] })');
      }

      implicit.forEach(function (type$1) {
        if (!(type$1 instanceof type)) {
          throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
        }

        if (type$1.loadKind && type$1.loadKind !== 'scalar') {
          throw new exception('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
        }

        if (type$1.multi) {
          throw new exception('There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.');
        }
      });

      explicit.forEach(function (type$1) {
        if (!(type$1 instanceof type)) {
          throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
        }
      });

      var result = Object.create(Schema$1.prototype);

      result.implicit = (this.implicit || []).concat(implicit);
      result.explicit = (this.explicit || []).concat(explicit);

      result.compiledImplicit = compileList(result, 'implicit');
      result.compiledExplicit = compileList(result, 'explicit');
      result.compiledTypeMap  = compileMap(result.compiledImplicit, result.compiledExplicit);

      return result;
    };


    var schema = Schema$1;

    var str = new type('tag:yaml.org,2002:str', {
      kind: 'scalar',
      construct: function (data) { return data !== null ? data : ''; }
    });

    var seq = new type('tag:yaml.org,2002:seq', {
      kind: 'sequence',
      construct: function (data) { return data !== null ? data : []; }
    });

    var map = new type('tag:yaml.org,2002:map', {
      kind: 'mapping',
      construct: function (data) { return data !== null ? data : {}; }
    });

    var failsafe = new schema({
      explicit: [
        str,
        seq,
        map
      ]
    });

    function resolveYamlNull(data) {
      if (data === null) return true;

      var max = data.length;

      return (max === 1 && data === '~') ||
             (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
    }

    function constructYamlNull() {
      return null;
    }

    function isNull(object) {
      return object === null;
    }

    var _null = new type('tag:yaml.org,2002:null', {
      kind: 'scalar',
      resolve: resolveYamlNull,
      construct: constructYamlNull,
      predicate: isNull,
      represent: {
        canonical: function () { return '~';    },
        lowercase: function () { return 'null'; },
        uppercase: function () { return 'NULL'; },
        camelcase: function () { return 'Null'; },
        empty:     function () { return '';     }
      },
      defaultStyle: 'lowercase'
    });

    function resolveYamlBoolean(data) {
      if (data === null) return false;

      var max = data.length;

      return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
             (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
    }

    function constructYamlBoolean(data) {
      return data === 'true' ||
             data === 'True' ||
             data === 'TRUE';
    }

    function isBoolean(object) {
      return Object.prototype.toString.call(object) === '[object Boolean]';
    }

    var bool = new type('tag:yaml.org,2002:bool', {
      kind: 'scalar',
      resolve: resolveYamlBoolean,
      construct: constructYamlBoolean,
      predicate: isBoolean,
      represent: {
        lowercase: function (object) { return object ? 'true' : 'false'; },
        uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
        camelcase: function (object) { return object ? 'True' : 'False'; }
      },
      defaultStyle: 'lowercase'
    });

    function isHexCode(c) {
      return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) ||
             ((0x41/* A */ <= c) && (c <= 0x46/* F */)) ||
             ((0x61/* a */ <= c) && (c <= 0x66/* f */));
    }

    function isOctCode(c) {
      return ((0x30/* 0 */ <= c) && (c <= 0x37/* 7 */));
    }

    function isDecCode(c) {
      return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */));
    }

    function resolveYamlInteger(data) {
      if (data === null) return false;

      var max = data.length,
          index = 0,
          hasDigits = false,
          ch;

      if (!max) return false;

      ch = data[index];

      // sign
      if (ch === '-' || ch === '+') {
        ch = data[++index];
      }

      if (ch === '0') {
        // 0
        if (index + 1 === max) return true;
        ch = data[++index];

        // base 2, base 8, base 16

        if (ch === 'b') {
          // base 2
          index++;

          for (; index < max; index++) {
            ch = data[index];
            if (ch === '_') continue;
            if (ch !== '0' && ch !== '1') return false;
            hasDigits = true;
          }
          return hasDigits && ch !== '_';
        }


        if (ch === 'x') {
          // base 16
          index++;

          for (; index < max; index++) {
            ch = data[index];
            if (ch === '_') continue;
            if (!isHexCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && ch !== '_';
        }


        if (ch === 'o') {
          // base 8
          index++;

          for (; index < max; index++) {
            ch = data[index];
            if (ch === '_') continue;
            if (!isOctCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && ch !== '_';
        }
      }

      // base 10 (except 0)

      // value should not start with `_`;
      if (ch === '_') return false;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isDecCode(data.charCodeAt(index))) {
          return false;
        }
        hasDigits = true;
      }

      // Should have digits and should not end with `_`
      if (!hasDigits || ch === '_') return false;

      return true;
    }

    function constructYamlInteger(data) {
      var value = data, sign = 1, ch;

      if (value.indexOf('_') !== -1) {
        value = value.replace(/_/g, '');
      }

      ch = value[0];

      if (ch === '-' || ch === '+') {
        if (ch === '-') sign = -1;
        value = value.slice(1);
        ch = value[0];
      }

      if (value === '0') return 0;

      if (ch === '0') {
        if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
        if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
        if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
      }

      return sign * parseInt(value, 10);
    }

    function isInteger(object) {
      return (Object.prototype.toString.call(object)) === '[object Number]' &&
             (object % 1 === 0 && !common.isNegativeZero(object));
    }

    var int = new type('tag:yaml.org,2002:int', {
      kind: 'scalar',
      resolve: resolveYamlInteger,
      construct: constructYamlInteger,
      predicate: isInteger,
      represent: {
        binary:      function (obj) { return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1); },
        octal:       function (obj) { return obj >= 0 ? '0o'  + obj.toString(8) : '-0o'  + obj.toString(8).slice(1); },
        decimal:     function (obj) { return obj.toString(10); },
        /* eslint-disable max-len */
        hexadecimal: function (obj) { return obj >= 0 ? '0x' + obj.toString(16).toUpperCase() :  '-0x' + obj.toString(16).toUpperCase().slice(1); }
      },
      defaultStyle: 'decimal',
      styleAliases: {
        binary:      [ 2,  'bin' ],
        octal:       [ 8,  'oct' ],
        decimal:     [ 10, 'dec' ],
        hexadecimal: [ 16, 'hex' ]
      }
    });

    var YAML_FLOAT_PATTERN = new RegExp(
      // 2.5e4, 2.5 and integers
      '^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
      // .2e4, .2
      // special case, seems not from spec
      '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
      // .inf
      '|[-+]?\\.(?:inf|Inf|INF)' +
      // .nan
      '|\\.(?:nan|NaN|NAN))$');

    function resolveYamlFloat(data) {
      if (data === null) return false;

      if (!YAML_FLOAT_PATTERN.test(data) ||
          // Quick hack to not allow integers end with `_`
          // Probably should update regexp & check speed
          data[data.length - 1] === '_') {
        return false;
      }

      return true;
    }

    function constructYamlFloat(data) {
      var value, sign;

      value  = data.replace(/_/g, '').toLowerCase();
      sign   = value[0] === '-' ? -1 : 1;

      if ('+-'.indexOf(value[0]) >= 0) {
        value = value.slice(1);
      }

      if (value === '.inf') {
        return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

      } else if (value === '.nan') {
        return NaN;
      }
      return sign * parseFloat(value, 10);
    }


    var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

    function representYamlFloat(object, style) {
      var res;

      if (isNaN(object)) {
        switch (style) {
          case 'lowercase': return '.nan';
          case 'uppercase': return '.NAN';
          case 'camelcase': return '.NaN';
        }
      } else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
          case 'lowercase': return '.inf';
          case 'uppercase': return '.INF';
          case 'camelcase': return '.Inf';
        }
      } else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
          case 'lowercase': return '-.inf';
          case 'uppercase': return '-.INF';
          case 'camelcase': return '-.Inf';
        }
      } else if (common.isNegativeZero(object)) {
        return '-0.0';
      }

      res = object.toString(10);

      // JS stringifier can build scientific format without dots: 5e-100,
      // while YAML requres dot: 5.e-100. Fix it with simple hack

      return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
    }

    function isFloat(object) {
      return (Object.prototype.toString.call(object) === '[object Number]') &&
             (object % 1 !== 0 || common.isNegativeZero(object));
    }

    var float = new type('tag:yaml.org,2002:float', {
      kind: 'scalar',
      resolve: resolveYamlFloat,
      construct: constructYamlFloat,
      predicate: isFloat,
      represent: representYamlFloat,
      defaultStyle: 'lowercase'
    });

    var json = failsafe.extend({
      implicit: [
        _null,
        bool,
        int,
        float
      ]
    });

    var core = json;

    var YAML_DATE_REGEXP = new RegExp(
      '^([0-9][0-9][0-9][0-9])'          + // [1] year
      '-([0-9][0-9])'                    + // [2] month
      '-([0-9][0-9])$');                   // [3] day

    var YAML_TIMESTAMP_REGEXP = new RegExp(
      '^([0-9][0-9][0-9][0-9])'          + // [1] year
      '-([0-9][0-9]?)'                   + // [2] month
      '-([0-9][0-9]?)'                   + // [3] day
      '(?:[Tt]|[ \\t]+)'                 + // ...
      '([0-9][0-9]?)'                    + // [4] hour
      ':([0-9][0-9])'                    + // [5] minute
      ':([0-9][0-9])'                    + // [6] second
      '(?:\\.([0-9]*))?'                 + // [7] fraction
      '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tz_hour
      '(?::([0-9][0-9]))?))?$');           // [11] tz_minute

    function resolveYamlTimestamp(data) {
      if (data === null) return false;
      if (YAML_DATE_REGEXP.exec(data) !== null) return true;
      if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
      return false;
    }

    function constructYamlTimestamp(data) {
      var match, year, month, day, hour, minute, second, fraction = 0,
          delta = null, tz_hour, tz_minute, date;

      match = YAML_DATE_REGEXP.exec(data);
      if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

      if (match === null) throw new Error('Date resolve error');

      // match: [1] year [2] month [3] day

      year = +(match[1]);
      month = +(match[2]) - 1; // JS month starts with 0
      day = +(match[3]);

      if (!match[4]) { // no hour
        return new Date(Date.UTC(year, month, day));
      }

      // match: [4] hour [5] minute [6] second [7] fraction

      hour = +(match[4]);
      minute = +(match[5]);
      second = +(match[6]);

      if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) { // milli-seconds
          fraction += '0';
        }
        fraction = +fraction;
      }

      // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute

      if (match[9]) {
        tz_hour = +(match[10]);
        tz_minute = +(match[11] || 0);
        delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
        if (match[9] === '-') delta = -delta;
      }

      date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

      if (delta) date.setTime(date.getTime() - delta);

      return date;
    }

    function representYamlTimestamp(object /*, style*/) {
      return object.toISOString();
    }

    var timestamp = new type('tag:yaml.org,2002:timestamp', {
      kind: 'scalar',
      resolve: resolveYamlTimestamp,
      construct: constructYamlTimestamp,
      instanceOf: Date,
      represent: representYamlTimestamp
    });

    function resolveYamlMerge(data) {
      return data === '<<' || data === null;
    }

    var merge = new type('tag:yaml.org,2002:merge', {
      kind: 'scalar',
      resolve: resolveYamlMerge
    });

    /*eslint-disable no-bitwise*/





    // [ 64, 65, 66 ] -> [ padding, CR, LF ]
    var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';


    function resolveYamlBinary(data) {
      if (data === null) return false;

      var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;

      // Convert one by one.
      for (idx = 0; idx < max; idx++) {
        code = map.indexOf(data.charAt(idx));

        // Skip CR/LF
        if (code > 64) continue;

        // Fail on illegal characters
        if (code < 0) return false;

        bitlen += 6;
      }

      // If there are any bits left, source was corrupted
      return (bitlen % 8) === 0;
    }

    function constructYamlBinary(data) {
      var idx, tailbits,
          input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
          max = input.length,
          map = BASE64_MAP,
          bits = 0,
          result = [];

      // Collect by 6*4 bits (3 bytes)

      for (idx = 0; idx < max; idx++) {
        if ((idx % 4 === 0) && idx) {
          result.push((bits >> 16) & 0xFF);
          result.push((bits >> 8) & 0xFF);
          result.push(bits & 0xFF);
        }

        bits = (bits << 6) | map.indexOf(input.charAt(idx));
      }

      // Dump tail

      tailbits = (max % 4) * 6;

      if (tailbits === 0) {
        result.push((bits >> 16) & 0xFF);
        result.push((bits >> 8) & 0xFF);
        result.push(bits & 0xFF);
      } else if (tailbits === 18) {
        result.push((bits >> 10) & 0xFF);
        result.push((bits >> 2) & 0xFF);
      } else if (tailbits === 12) {
        result.push((bits >> 4) & 0xFF);
      }

      return new Uint8Array(result);
    }

    function representYamlBinary(object /*, style*/) {
      var result = '', bits = 0, idx, tail,
          max = object.length,
          map = BASE64_MAP;

      // Convert every three bytes to 4 ASCII characters.

      for (idx = 0; idx < max; idx++) {
        if ((idx % 3 === 0) && idx) {
          result += map[(bits >> 18) & 0x3F];
          result += map[(bits >> 12) & 0x3F];
          result += map[(bits >> 6) & 0x3F];
          result += map[bits & 0x3F];
        }

        bits = (bits << 8) + object[idx];
      }

      // Dump tail

      tail = max % 3;

      if (tail === 0) {
        result += map[(bits >> 18) & 0x3F];
        result += map[(bits >> 12) & 0x3F];
        result += map[(bits >> 6) & 0x3F];
        result += map[bits & 0x3F];
      } else if (tail === 2) {
        result += map[(bits >> 10) & 0x3F];
        result += map[(bits >> 4) & 0x3F];
        result += map[(bits << 2) & 0x3F];
        result += map[64];
      } else if (tail === 1) {
        result += map[(bits >> 2) & 0x3F];
        result += map[(bits << 4) & 0x3F];
        result += map[64];
        result += map[64];
      }

      return result;
    }

    function isBinary(obj) {
      return Object.prototype.toString.call(obj) ===  '[object Uint8Array]';
    }

    var binary = new type('tag:yaml.org,2002:binary', {
      kind: 'scalar',
      resolve: resolveYamlBinary,
      construct: constructYamlBinary,
      predicate: isBinary,
      represent: representYamlBinary
    });

    var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
    var _toString$2       = Object.prototype.toString;

    function resolveYamlOmap(data) {
      if (data === null) return true;

      var objectKeys = [], index, length, pair, pairKey, pairHasKey,
          object = data;

      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        pairHasKey = false;

        if (_toString$2.call(pair) !== '[object Object]') return false;

        for (pairKey in pair) {
          if (_hasOwnProperty$3.call(pair, pairKey)) {
            if (!pairHasKey) pairHasKey = true;
            else return false;
          }
        }

        if (!pairHasKey) return false;

        if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
        else return false;
      }

      return true;
    }

    function constructYamlOmap(data) {
      return data !== null ? data : [];
    }

    var omap = new type('tag:yaml.org,2002:omap', {
      kind: 'sequence',
      resolve: resolveYamlOmap,
      construct: constructYamlOmap
    });

    var _toString$1 = Object.prototype.toString;

    function resolveYamlPairs(data) {
      if (data === null) return true;

      var index, length, pair, keys, result,
          object = data;

      result = new Array(object.length);

      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];

        if (_toString$1.call(pair) !== '[object Object]') return false;

        keys = Object.keys(pair);

        if (keys.length !== 1) return false;

        result[index] = [ keys[0], pair[keys[0]] ];
      }

      return true;
    }

    function constructYamlPairs(data) {
      if (data === null) return [];

      var index, length, pair, keys, result,
          object = data;

      result = new Array(object.length);

      for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];

        keys = Object.keys(pair);

        result[index] = [ keys[0], pair[keys[0]] ];
      }

      return result;
    }

    var pairs = new type('tag:yaml.org,2002:pairs', {
      kind: 'sequence',
      resolve: resolveYamlPairs,
      construct: constructYamlPairs
    });

    var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;

    function resolveYamlSet(data) {
      if (data === null) return true;

      var key, object = data;

      for (key in object) {
        if (_hasOwnProperty$2.call(object, key)) {
          if (object[key] !== null) return false;
        }
      }

      return true;
    }

    function constructYamlSet(data) {
      return data !== null ? data : {};
    }

    var set = new type('tag:yaml.org,2002:set', {
      kind: 'mapping',
      resolve: resolveYamlSet,
      construct: constructYamlSet
    });

    var _default = core.extend({
      implicit: [
        timestamp,
        merge
      ],
      explicit: [
        binary,
        omap,
        pairs,
        set
      ]
    });

    /*eslint-disable max-len,no-use-before-define*/







    var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;


    var CONTEXT_FLOW_IN   = 1;
    var CONTEXT_FLOW_OUT  = 2;
    var CONTEXT_BLOCK_IN  = 3;
    var CONTEXT_BLOCK_OUT = 4;


    var CHOMPING_CLIP  = 1;
    var CHOMPING_STRIP = 2;
    var CHOMPING_KEEP  = 3;


    var PATTERN_NON_PRINTABLE         = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
    var PATTERN_FLOW_INDICATORS       = /[,\[\]\{\}]/;
    var PATTERN_TAG_HANDLE            = /^(?:!|!!|![a-z\-]+!)$/i;
    var PATTERN_TAG_URI               = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;


    function _class(obj) { return Object.prototype.toString.call(obj); }

    function is_EOL(c) {
      return (c === 0x0A/* LF */) || (c === 0x0D/* CR */);
    }

    function is_WHITE_SPACE(c) {
      return (c === 0x09/* Tab */) || (c === 0x20/* Space */);
    }

    function is_WS_OR_EOL(c) {
      return (c === 0x09/* Tab */) ||
             (c === 0x20/* Space */) ||
             (c === 0x0A/* LF */) ||
             (c === 0x0D/* CR */);
    }

    function is_FLOW_INDICATOR(c) {
      return c === 0x2C/* , */ ||
             c === 0x5B/* [ */ ||
             c === 0x5D/* ] */ ||
             c === 0x7B/* { */ ||
             c === 0x7D/* } */;
    }

    function fromHexCode(c) {
      var lc;

      if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
        return c - 0x30;
      }

      /*eslint-disable no-bitwise*/
      lc = c | 0x20;

      if ((0x61/* a */ <= lc) && (lc <= 0x66/* f */)) {
        return lc - 0x61 + 10;
      }

      return -1;
    }

    function escapedHexLen(c) {
      if (c === 0x78/* x */) { return 2; }
      if (c === 0x75/* u */) { return 4; }
      if (c === 0x55/* U */) { return 8; }
      return 0;
    }

    function fromDecimalCode(c) {
      if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
        return c - 0x30;
      }

      return -1;
    }

    function simpleEscapeSequence(c) {
      /* eslint-disable indent */
      return (c === 0x30/* 0 */) ? '\x00' :
            (c === 0x61/* a */) ? '\x07' :
            (c === 0x62/* b */) ? '\x08' :
            (c === 0x74/* t */) ? '\x09' :
            (c === 0x09/* Tab */) ? '\x09' :
            (c === 0x6E/* n */) ? '\x0A' :
            (c === 0x76/* v */) ? '\x0B' :
            (c === 0x66/* f */) ? '\x0C' :
            (c === 0x72/* r */) ? '\x0D' :
            (c === 0x65/* e */) ? '\x1B' :
            (c === 0x20/* Space */) ? ' ' :
            (c === 0x22/* " */) ? '\x22' :
            (c === 0x2F/* / */) ? '/' :
            (c === 0x5C/* \ */) ? '\x5C' :
            (c === 0x4E/* N */) ? '\x85' :
            (c === 0x5F/* _ */) ? '\xA0' :
            (c === 0x4C/* L */) ? '\u2028' :
            (c === 0x50/* P */) ? '\u2029' : '';
    }

    function charFromCodepoint(c) {
      if (c <= 0xFFFF) {
        return String.fromCharCode(c);
      }
      // Encode UTF-16 surrogate pair
      // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
      return String.fromCharCode(
        ((c - 0x010000) >> 10) + 0xD800,
        ((c - 0x010000) & 0x03FF) + 0xDC00
      );
    }

    var simpleEscapeCheck = new Array(256); // integer, for fast access
    var simpleEscapeMap = new Array(256);
    for (var i = 0; i < 256; i++) {
      simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
      simpleEscapeMap[i] = simpleEscapeSequence(i);
    }


    function State$1(input, options) {
      this.input = input;

      this.filename  = options['filename']  || null;
      this.schema    = options['schema']    || _default;
      this.onWarning = options['onWarning'] || null;
      // (Hidden) Remove? makes the loader to expect YAML 1.1 documents
      // if such documents have no explicit %YAML directive
      this.legacy    = options['legacy']    || false;

      this.json      = options['json']      || false;
      this.listener  = options['listener']  || null;

      this.implicitTypes = this.schema.compiledImplicit;
      this.typeMap       = this.schema.compiledTypeMap;

      this.length     = input.length;
      this.position   = 0;
      this.line       = 0;
      this.lineStart  = 0;
      this.lineIndent = 0;

      // position of first leading tab in the current line,
      // used to make sure there are no tabs in the indentation
      this.firstTabInLine = -1;

      this.documents = [];

      /*
      this.version;
      this.checkLineBreaks;
      this.tagMap;
      this.anchorMap;
      this.tag;
      this.anchor;
      this.kind;
      this.result;*/

    }


    function generateError(state, message) {
      var mark = {
        name:     state.filename,
        buffer:   state.input.slice(0, -1), // omit trailing \0
        position: state.position,
        line:     state.line,
        column:   state.position - state.lineStart
      };

      mark.snippet = snippet(mark);

      return new exception(message, mark);
    }

    function throwError(state, message) {
      throw generateError(state, message);
    }

    function throwWarning(state, message) {
      if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
      }
    }


    var directiveHandlers = {

      YAML: function handleYamlDirective(state, name, args) {

        var match, major, minor;

        if (state.version !== null) {
          throwError(state, 'duplication of %YAML directive');
        }

        if (args.length !== 1) {
          throwError(state, 'YAML directive accepts exactly one argument');
        }

        match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

        if (match === null) {
          throwError(state, 'ill-formed argument of the YAML directive');
        }

        major = parseInt(match[1], 10);
        minor = parseInt(match[2], 10);

        if (major !== 1) {
          throwError(state, 'unacceptable YAML version of the document');
        }

        state.version = args[0];
        state.checkLineBreaks = (minor < 2);

        if (minor !== 1 && minor !== 2) {
          throwWarning(state, 'unsupported YAML version of the document');
        }
      },

      TAG: function handleTagDirective(state, name, args) {

        var handle, prefix;

        if (args.length !== 2) {
          throwError(state, 'TAG directive accepts exactly two arguments');
        }

        handle = args[0];
        prefix = args[1];

        if (!PATTERN_TAG_HANDLE.test(handle)) {
          throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
        }

        if (_hasOwnProperty$1.call(state.tagMap, handle)) {
          throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
        }

        if (!PATTERN_TAG_URI.test(prefix)) {
          throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
        }

        try {
          prefix = decodeURIComponent(prefix);
        } catch (err) {
          throwError(state, 'tag prefix is malformed: ' + prefix);
        }

        state.tagMap[handle] = prefix;
      }
    };


    function captureSegment(state, start, end, checkJson) {
      var _position, _length, _character, _result;

      if (start < end) {
        _result = state.input.slice(start, end);

        if (checkJson) {
          for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
            _character = _result.charCodeAt(_position);
            if (!(_character === 0x09 ||
                  (0x20 <= _character && _character <= 0x10FFFF))) {
              throwError(state, 'expected valid JSON character');
            }
          }
        } else if (PATTERN_NON_PRINTABLE.test(_result)) {
          throwError(state, 'the stream contains non-printable characters');
        }

        state.result += _result;
      }
    }

    function mergeMappings(state, destination, source, overridableKeys) {
      var sourceKeys, key, index, quantity;

      if (!common.isObject(source)) {
        throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
      }

      sourceKeys = Object.keys(source);

      for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        key = sourceKeys[index];

        if (!_hasOwnProperty$1.call(destination, key)) {
          destination[key] = source[key];
          overridableKeys[key] = true;
        }
      }
    }

    function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode,
      startLine, startLineStart, startPos) {

      var index, quantity;

      // The output is a plain object here, so keys can only be strings.
      // We need to convert keyNode to a string, but doing so can hang the process
      // (deeply nested arrays that explode exponentially using aliases).
      if (Array.isArray(keyNode)) {
        keyNode = Array.prototype.slice.call(keyNode);

        for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
          if (Array.isArray(keyNode[index])) {
            throwError(state, 'nested arrays are not supported inside keys');
          }

          if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
            keyNode[index] = '[object Object]';
          }
        }
      }

      // Avoid code execution in load() via toString property
      // (still use its own toString for arrays, timestamps,
      // and whatever user schema extensions happen to have @@toStringTag)
      if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
        keyNode = '[object Object]';
      }


      keyNode = String(keyNode);

      if (_result === null) {
        _result = {};
      }

      if (keyTag === 'tag:yaml.org,2002:merge') {
        if (Array.isArray(valueNode)) {
          for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
            mergeMappings(state, _result, valueNode[index], overridableKeys);
          }
        } else {
          mergeMappings(state, _result, valueNode, overridableKeys);
        }
      } else {
        if (!state.json &&
            !_hasOwnProperty$1.call(overridableKeys, keyNode) &&
            _hasOwnProperty$1.call(_result, keyNode)) {
          state.line = startLine || state.line;
          state.lineStart = startLineStart || state.lineStart;
          state.position = startPos || state.position;
          throwError(state, 'duplicated mapping key');
        }

        // used for this specific key only because Object.defineProperty is slow
        if (keyNode === '__proto__') {
          Object.defineProperty(_result, keyNode, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: valueNode
          });
        } else {
          _result[keyNode] = valueNode;
        }
        delete overridableKeys[keyNode];
      }

      return _result;
    }

    function readLineBreak(state) {
      var ch;

      ch = state.input.charCodeAt(state.position);

      if (ch === 0x0A/* LF */) {
        state.position++;
      } else if (ch === 0x0D/* CR */) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
          state.position++;
        }
      } else {
        throwError(state, 'a line break is expected');
      }

      state.line += 1;
      state.lineStart = state.position;
      state.firstTabInLine = -1;
    }

    function skipSeparationSpace(state, allowComments, checkIndent) {
      var lineBreaks = 0,
          ch = state.input.charCodeAt(state.position);

      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          if (ch === 0x09/* Tab */ && state.firstTabInLine === -1) {
            state.firstTabInLine = state.position;
          }
          ch = state.input.charCodeAt(++state.position);
        }

        if (allowComments && ch === 0x23/* # */) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0);
        }

        if (is_EOL(ch)) {
          readLineBreak(state);

          ch = state.input.charCodeAt(state.position);
          lineBreaks++;
          state.lineIndent = 0;

          while (ch === 0x20/* Space */) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
          }
        } else {
          break;
        }
      }

      if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, 'deficient indentation');
      }

      return lineBreaks;
    }

    function testDocumentSeparator(state) {
      var _position = state.position,
          ch;

      ch = state.input.charCodeAt(_position);

      // Condition state.position === state.lineStart is tested
      // in parent on each call, for efficiency. No needs to test here again.
      if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
          ch === state.input.charCodeAt(_position + 1) &&
          ch === state.input.charCodeAt(_position + 2)) {

        _position += 3;

        ch = state.input.charCodeAt(_position);

        if (ch === 0 || is_WS_OR_EOL(ch)) {
          return true;
        }
      }

      return false;
    }

    function writeFoldedLines(state, count) {
      if (count === 1) {
        state.result += ' ';
      } else if (count > 1) {
        state.result += common.repeat('\n', count - 1);
      }
    }


    function readPlainScalar(state, nodeIndent, withinFlowCollection) {
      var preceding,
          following,
          captureStart,
          captureEnd,
          hasPendingContent,
          _line,
          _lineStart,
          _lineIndent,
          _kind = state.kind,
          _result = state.result,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (is_WS_OR_EOL(ch)      ||
          is_FLOW_INDICATOR(ch) ||
          ch === 0x23/* # */    ||
          ch === 0x26/* & */    ||
          ch === 0x2A/* * */    ||
          ch === 0x21/* ! */    ||
          ch === 0x7C/* | */    ||
          ch === 0x3E/* > */    ||
          ch === 0x27/* ' */    ||
          ch === 0x22/* " */    ||
          ch === 0x25/* % */    ||
          ch === 0x40/* @ */    ||
          ch === 0x60/* ` */) {
        return false;
      }

      if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
        following = state.input.charCodeAt(state.position + 1);

        if (is_WS_OR_EOL(following) ||
            withinFlowCollection && is_FLOW_INDICATOR(following)) {
          return false;
        }
      }

      state.kind = 'scalar';
      state.result = '';
      captureStart = captureEnd = state.position;
      hasPendingContent = false;

      while (ch !== 0) {
        if (ch === 0x3A/* : */) {
          following = state.input.charCodeAt(state.position + 1);

          if (is_WS_OR_EOL(following) ||
              withinFlowCollection && is_FLOW_INDICATOR(following)) {
            break;
          }

        } else if (ch === 0x23/* # */) {
          preceding = state.input.charCodeAt(state.position - 1);

          if (is_WS_OR_EOL(preceding)) {
            break;
          }

        } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
                   withinFlowCollection && is_FLOW_INDICATOR(ch)) {
          break;

        } else if (is_EOL(ch)) {
          _line = state.line;
          _lineStart = state.lineStart;
          _lineIndent = state.lineIndent;
          skipSeparationSpace(state, false, -1);

          if (state.lineIndent >= nodeIndent) {
            hasPendingContent = true;
            ch = state.input.charCodeAt(state.position);
            continue;
          } else {
            state.position = captureEnd;
            state.line = _line;
            state.lineStart = _lineStart;
            state.lineIndent = _lineIndent;
            break;
          }
        }

        if (hasPendingContent) {
          captureSegment(state, captureStart, captureEnd, false);
          writeFoldedLines(state, state.line - _line);
          captureStart = captureEnd = state.position;
          hasPendingContent = false;
        }

        if (!is_WHITE_SPACE(ch)) {
          captureEnd = state.position + 1;
        }

        ch = state.input.charCodeAt(++state.position);
      }

      captureSegment(state, captureStart, captureEnd, false);

      if (state.result) {
        return true;
      }

      state.kind = _kind;
      state.result = _result;
      return false;
    }

    function readSingleQuotedScalar(state, nodeIndent) {
      var ch,
          captureStart, captureEnd;

      ch = state.input.charCodeAt(state.position);

      if (ch !== 0x27/* ' */) {
        return false;
      }

      state.kind = 'scalar';
      state.result = '';
      state.position++;
      captureStart = captureEnd = state.position;

      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x27/* ' */) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);

          if (ch === 0x27/* ' */) {
            captureStart = state.position;
            state.position++;
            captureEnd = state.position;
          } else {
            return true;
          }

        } else if (is_EOL(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;

        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, 'unexpected end of the document within a single quoted scalar');

        } else {
          state.position++;
          captureEnd = state.position;
        }
      }

      throwError(state, 'unexpected end of the stream within a single quoted scalar');
    }

    function readDoubleQuotedScalar(state, nodeIndent) {
      var captureStart,
          captureEnd,
          hexLength,
          hexResult,
          tmp,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch !== 0x22/* " */) {
        return false;
      }

      state.kind = 'scalar';
      state.result = '';
      state.position++;
      captureStart = captureEnd = state.position;

      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x22/* " */) {
          captureSegment(state, captureStart, state.position, true);
          state.position++;
          return true;

        } else if (ch === 0x5C/* \ */) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);

          if (is_EOL(ch)) {
            skipSeparationSpace(state, false, nodeIndent);

            // TODO: rework to inline fn with no type cast?
          } else if (ch < 256 && simpleEscapeCheck[ch]) {
            state.result += simpleEscapeMap[ch];
            state.position++;

          } else if ((tmp = escapedHexLen(ch)) > 0) {
            hexLength = tmp;
            hexResult = 0;

            for (; hexLength > 0; hexLength--) {
              ch = state.input.charCodeAt(++state.position);

              if ((tmp = fromHexCode(ch)) >= 0) {
                hexResult = (hexResult << 4) + tmp;

              } else {
                throwError(state, 'expected hexadecimal character');
              }
            }

            state.result += charFromCodepoint(hexResult);

            state.position++;

          } else {
            throwError(state, 'unknown escape sequence');
          }

          captureStart = captureEnd = state.position;

        } else if (is_EOL(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;

        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, 'unexpected end of the document within a double quoted scalar');

        } else {
          state.position++;
          captureEnd = state.position;
        }
      }

      throwError(state, 'unexpected end of the stream within a double quoted scalar');
    }

    function readFlowCollection(state, nodeIndent) {
      var readNext = true,
          _line,
          _lineStart,
          _pos,
          _tag     = state.tag,
          _result,
          _anchor  = state.anchor,
          following,
          terminator,
          isPair,
          isExplicitPair,
          isMapping,
          overridableKeys = Object.create(null),
          keyNode,
          keyTag,
          valueNode,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch === 0x5B/* [ */) {
        terminator = 0x5D;/* ] */
        isMapping = false;
        _result = [];
      } else if (ch === 0x7B/* { */) {
        terminator = 0x7D;/* } */
        isMapping = true;
        _result = {};
      } else {
        return false;
      }

      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }

      ch = state.input.charCodeAt(++state.position);

      while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);

        ch = state.input.charCodeAt(state.position);

        if (ch === terminator) {
          state.position++;
          state.tag = _tag;
          state.anchor = _anchor;
          state.kind = isMapping ? 'mapping' : 'sequence';
          state.result = _result;
          return true;
        } else if (!readNext) {
          throwError(state, 'missed comma between flow collection entries');
        } else if (ch === 0x2C/* , */) {
          // "flow collection entries can never be completely empty", as per YAML 1.2, section 7.4
          throwError(state, "expected the node content, but found ','");
        }

        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;

        if (ch === 0x3F/* ? */) {
          following = state.input.charCodeAt(state.position + 1);

          if (is_WS_OR_EOL(following)) {
            isPair = isExplicitPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
          }
        }

        _line = state.line; // Save the current line.
        _lineStart = state.lineStart;
        _pos = state.position;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);

        ch = state.input.charCodeAt(state.position);

        if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
          isPair = true;
          ch = state.input.charCodeAt(++state.position);
          skipSeparationSpace(state, true, nodeIndent);
          composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
          valueNode = state.result;
        }

        if (isMapping) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
        } else if (isPair) {
          _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
        } else {
          _result.push(keyNode);
        }

        skipSeparationSpace(state, true, nodeIndent);

        ch = state.input.charCodeAt(state.position);

        if (ch === 0x2C/* , */) {
          readNext = true;
          ch = state.input.charCodeAt(++state.position);
        } else {
          readNext = false;
        }
      }

      throwError(state, 'unexpected end of the stream within a flow collection');
    }

    function readBlockScalar(state, nodeIndent) {
      var captureStart,
          folding,
          chomping       = CHOMPING_CLIP,
          didReadContent = false,
          detectedIndent = false,
          textIndent     = nodeIndent,
          emptyLines     = 0,
          atMoreIndented = false,
          tmp,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch === 0x7C/* | */) {
        folding = false;
      } else if (ch === 0x3E/* > */) {
        folding = true;
      } else {
        return false;
      }

      state.kind = 'scalar';
      state.result = '';

      while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);

        if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
          if (CHOMPING_CLIP === chomping) {
            chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
          } else {
            throwError(state, 'repeat of a chomping mode identifier');
          }

        } else if ((tmp = fromDecimalCode(ch)) >= 0) {
          if (tmp === 0) {
            throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
          } else if (!detectedIndent) {
            textIndent = nodeIndent + tmp - 1;
            detectedIndent = true;
          } else {
            throwError(state, 'repeat of an indentation width identifier');
          }

        } else {
          break;
        }
      }

      if (is_WHITE_SPACE(ch)) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (is_WHITE_SPACE(ch));

        if (ch === 0x23/* # */) {
          do { ch = state.input.charCodeAt(++state.position); }
          while (!is_EOL(ch) && (ch !== 0));
        }
      }

      while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;

        ch = state.input.charCodeAt(state.position);

        while ((!detectedIndent || state.lineIndent < textIndent) &&
               (ch === 0x20/* Space */)) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }

        if (!detectedIndent && state.lineIndent > textIndent) {
          textIndent = state.lineIndent;
        }

        if (is_EOL(ch)) {
          emptyLines++;
          continue;
        }

        // End of the scalar.
        if (state.lineIndent < textIndent) {

          // Perform the chomping.
          if (chomping === CHOMPING_KEEP) {
            state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
          } else if (chomping === CHOMPING_CLIP) {
            if (didReadContent) { // i.e. only if the scalar is not empty.
              state.result += '\n';
            }
          }

          // Break this `while` cycle and go to the funciton's epilogue.
          break;
        }

        // Folded style: use fancy rules to handle line breaks.
        if (folding) {

          // Lines starting with white space characters (more-indented lines) are not folded.
          if (is_WHITE_SPACE(ch)) {
            atMoreIndented = true;
            // except for the first content line (cf. Example 8.1)
            state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

          // End of more-indented block.
          } else if (atMoreIndented) {
            atMoreIndented = false;
            state.result += common.repeat('\n', emptyLines + 1);

          // Just one line break - perceive as the same line.
          } else if (emptyLines === 0) {
            if (didReadContent) { // i.e. only if we have already read some scalar content.
              state.result += ' ';
            }

          // Several line breaks - perceive as different lines.
          } else {
            state.result += common.repeat('\n', emptyLines);
          }

        // Literal style: just add exact number of line breaks between content lines.
        } else {
          // Keep all line breaks except the header line break.
          state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
        }

        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        captureStart = state.position;

        while (!is_EOL(ch) && (ch !== 0)) {
          ch = state.input.charCodeAt(++state.position);
        }

        captureSegment(state, captureStart, state.position, false);
      }

      return true;
    }

    function readBlockSequence(state, nodeIndent) {
      var _line,
          _tag      = state.tag,
          _anchor   = state.anchor,
          _result   = [],
          following,
          detected  = false,
          ch;

      // there is a leading tab before this token, so it can't be a block sequence/mapping;
      // it can still be flow sequence/mapping or a scalar
      if (state.firstTabInLine !== -1) return false;

      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }

      ch = state.input.charCodeAt(state.position);

      while (ch !== 0) {
        if (state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, 'tab characters must not be used in indentation');
        }

        if (ch !== 0x2D/* - */) {
          break;
        }

        following = state.input.charCodeAt(state.position + 1);

        if (!is_WS_OR_EOL(following)) {
          break;
        }

        detected = true;
        state.position++;

        if (skipSeparationSpace(state, true, -1)) {
          if (state.lineIndent <= nodeIndent) {
            _result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
          }
        }

        _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);

        ch = state.input.charCodeAt(state.position);

        if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
          throwError(state, 'bad indentation of a sequence entry');
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }

      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'sequence';
        state.result = _result;
        return true;
      }
      return false;
    }

    function readBlockMapping(state, nodeIndent, flowIndent) {
      var following,
          allowCompact,
          _line,
          _keyLine,
          _keyLineStart,
          _keyPos,
          _tag          = state.tag,
          _anchor       = state.anchor,
          _result       = {},
          overridableKeys = Object.create(null),
          keyTag        = null,
          keyNode       = null,
          valueNode     = null,
          atExplicitKey = false,
          detected      = false,
          ch;

      // there is a leading tab before this token, so it can't be a block sequence/mapping;
      // it can still be flow sequence/mapping or a scalar
      if (state.firstTabInLine !== -1) return false;

      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
      }

      ch = state.input.charCodeAt(state.position);

      while (ch !== 0) {
        if (!atExplicitKey && state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, 'tab characters must not be used in indentation');
        }

        following = state.input.charCodeAt(state.position + 1);
        _line = state.line; // Save the current line.

        //
        // Explicit notation case. There are two separate blocks:
        // first for the key (denoted by "?") and second for the value (denoted by ":")
        //
        if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && is_WS_OR_EOL(following)) {

          if (ch === 0x3F/* ? */) {
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }

            detected = true;
            atExplicitKey = true;
            allowCompact = true;

          } else if (atExplicitKey) {
            // i.e. 0x3A/* : */ === character after the explicit key.
            atExplicitKey = false;
            allowCompact = true;

          } else {
            throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
          }

          state.position += 1;
          ch = following;

        //
        // Implicit notation case. Flow-style node as the key first, then ":", and the value.
        //
        } else {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;

          if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
            // Neither implicit nor explicit notation.
            // Reading is done. Go to the epilogue.
            break;
          }

          if (state.line === _line) {
            ch = state.input.charCodeAt(state.position);

            while (is_WHITE_SPACE(ch)) {
              ch = state.input.charCodeAt(++state.position);
            }

            if (ch === 0x3A/* : */) {
              ch = state.input.charCodeAt(++state.position);

              if (!is_WS_OR_EOL(ch)) {
                throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
              }

              if (atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
                keyTag = keyNode = valueNode = null;
              }

              detected = true;
              atExplicitKey = false;
              allowCompact = false;
              keyTag = state.tag;
              keyNode = state.result;

            } else if (detected) {
              throwError(state, 'can not read an implicit mapping pair; a colon is missed');

            } else {
              state.tag = _tag;
              state.anchor = _anchor;
              return true; // Keep the result of `composeNode`.
            }

          } else if (detected) {
            throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');

          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true; // Keep the result of `composeNode`.
          }
        }

        //
        // Common reading code for both explicit and implicit notations.
        //
        if (state.line === _line || state.lineIndent > nodeIndent) {
          if (atExplicitKey) {
            _keyLine = state.line;
            _keyLineStart = state.lineStart;
            _keyPos = state.position;
          }

          if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
            if (atExplicitKey) {
              keyNode = state.result;
            } else {
              valueNode = state.result;
            }
          }

          if (!atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }

          skipSeparationSpace(state, true, -1);
          ch = state.input.charCodeAt(state.position);
        }

        if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
          throwError(state, 'bad indentation of a mapping entry');
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }

      //
      // Epilogue.
      //

      // Special case: last mapping's node contains only the key in explicit notation.
      if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
      }

      // Expose the resulting mapping.
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'mapping';
        state.result = _result;
      }

      return detected;
    }

    function readTagProperty(state) {
      var _position,
          isVerbatim = false,
          isNamed    = false,
          tagHandle,
          tagName,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch !== 0x21/* ! */) return false;

      if (state.tag !== null) {
        throwError(state, 'duplication of a tag property');
      }

      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x3C/* < */) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);

      } else if (ch === 0x21/* ! */) {
        isNamed = true;
        tagHandle = '!!';
        ch = state.input.charCodeAt(++state.position);

      } else {
        tagHandle = '!';
      }

      _position = state.position;

      if (isVerbatim) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && ch !== 0x3E/* > */);

        if (state.position < state.length) {
          tagName = state.input.slice(_position, state.position);
          ch = state.input.charCodeAt(++state.position);
        } else {
          throwError(state, 'unexpected end of the stream within a verbatim tag');
        }
      } else {
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {

          if (ch === 0x21/* ! */) {
            if (!isNamed) {
              tagHandle = state.input.slice(_position - 1, state.position + 1);

              if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                throwError(state, 'named tag handle cannot contain such characters');
              }

              isNamed = true;
              _position = state.position + 1;
            } else {
              throwError(state, 'tag suffix cannot contain exclamation marks');
            }
          }

          ch = state.input.charCodeAt(++state.position);
        }

        tagName = state.input.slice(_position, state.position);

        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
          throwError(state, 'tag suffix cannot contain flow indicator characters');
        }
      }

      if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, 'tag name cannot contain such characters: ' + tagName);
      }

      try {
        tagName = decodeURIComponent(tagName);
      } catch (err) {
        throwError(state, 'tag name is malformed: ' + tagName);
      }

      if (isVerbatim) {
        state.tag = tagName;

      } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;

      } else if (tagHandle === '!') {
        state.tag = '!' + tagName;

      } else if (tagHandle === '!!') {
        state.tag = 'tag:yaml.org,2002:' + tagName;

      } else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
      }

      return true;
    }

    function readAnchorProperty(state) {
      var _position,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch !== 0x26/* & */) return false;

      if (state.anchor !== null) {
        throwError(state, 'duplication of an anchor property');
      }

      ch = state.input.charCodeAt(++state.position);
      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (state.position === _position) {
        throwError(state, 'name of an anchor node must contain at least one character');
      }

      state.anchor = state.input.slice(_position, state.position);
      return true;
    }

    function readAlias(state) {
      var _position, alias,
          ch;

      ch = state.input.charCodeAt(state.position);

      if (ch !== 0x2A/* * */) return false;

      ch = state.input.charCodeAt(++state.position);
      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (state.position === _position) {
        throwError(state, 'name of an alias node must contain at least one character');
      }

      alias = state.input.slice(_position, state.position);

      if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
      }

      state.result = state.anchorMap[alias];
      skipSeparationSpace(state, true, -1);
      return true;
    }

    function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
      var allowBlockStyles,
          allowBlockScalars,
          allowBlockCollections,
          indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
          atNewLine  = false,
          hasContent = false,
          typeIndex,
          typeQuantity,
          typeList,
          type,
          flowIndent,
          blockIndent;

      if (state.listener !== null) {
        state.listener('open', state);
      }

      state.tag    = null;
      state.anchor = null;
      state.kind   = null;
      state.result = null;

      allowBlockStyles = allowBlockScalars = allowBlockCollections =
        CONTEXT_BLOCK_OUT === nodeContext ||
        CONTEXT_BLOCK_IN  === nodeContext;

      if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;

          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        }
      }

      if (indentStatus === 1) {
        while (readTagProperty(state) || readAnchorProperty(state)) {
          if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            allowBlockCollections = allowBlockStyles;

            if (state.lineIndent > parentIndent) {
              indentStatus = 1;
            } else if (state.lineIndent === parentIndent) {
              indentStatus = 0;
            } else if (state.lineIndent < parentIndent) {
              indentStatus = -1;
            }
          } else {
            allowBlockCollections = false;
          }
        }
      }

      if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
      }

      if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
          flowIndent = parentIndent;
        } else {
          flowIndent = parentIndent + 1;
        }

        blockIndent = state.position - state.lineStart;

        if (indentStatus === 1) {
          if (allowBlockCollections &&
              (readBlockSequence(state, blockIndent) ||
               readBlockMapping(state, blockIndent, flowIndent)) ||
              readFlowCollection(state, flowIndent)) {
            hasContent = true;
          } else {
            if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
                readSingleQuotedScalar(state, flowIndent) ||
                readDoubleQuotedScalar(state, flowIndent)) {
              hasContent = true;

            } else if (readAlias(state)) {
              hasContent = true;

              if (state.tag !== null || state.anchor !== null) {
                throwError(state, 'alias node should not have any properties');
              }

            } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
              hasContent = true;

              if (state.tag === null) {
                state.tag = '?';
              }
            }

            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
          }
        } else if (indentStatus === 0) {
          // Special case: block sequences are allowed to have same indentation level as the parent.
          // http://www.yaml.org/spec/1.2/spec.html#id2799784
          hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
      }

      if (state.tag === null) {
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }

      } else if (state.tag === '?') {
        // Implicit resolving is not allowed for non-scalar types, and '?'
        // non-specific tag is only automatically assigned to plain scalars.
        //
        // We only need to check kind conformity in case user explicitly assigns '?'
        // tag, for example like this: "!<?> [0]"
        //
        if (state.result !== null && state.kind !== 'scalar') {
          throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
        }

        for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
          type = state.implicitTypes[typeIndex];

          if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
            state.result = type.construct(state.result);
            state.tag = type.tag;
            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
            break;
          }
        }
      } else if (state.tag !== '!') {
        if (_hasOwnProperty$1.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
          type = state.typeMap[state.kind || 'fallback'][state.tag];
        } else {
          // looking for multi type
          type = null;
          typeList = state.typeMap.multi[state.kind || 'fallback'];

          for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
            if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
              type = typeList[typeIndex];
              break;
            }
          }
        }

        if (!type) {
          throwError(state, 'unknown tag !<' + state.tag + '>');
        }

        if (state.result !== null && type.kind !== state.kind) {
          throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
        }

        if (!type.resolve(state.result, state.tag)) { // `state.result` updated in resolver if matched
          throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
        } else {
          state.result = type.construct(state.result, state.tag);
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      }

      if (state.listener !== null) {
        state.listener('close', state);
      }
      return state.tag !== null ||  state.anchor !== null || hasContent;
    }

    function readDocument(state) {
      var documentStart = state.position,
          _position,
          directiveName,
          directiveArgs,
          hasDirectives = false,
          ch;

      state.version = null;
      state.checkLineBreaks = state.legacy;
      state.tagMap = Object.create(null);
      state.anchorMap = Object.create(null);

      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);

        ch = state.input.charCodeAt(state.position);

        if (state.lineIndent > 0 || ch !== 0x25/* % */) {
          break;
        }

        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        _position = state.position;

        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        directiveName = state.input.slice(_position, state.position);
        directiveArgs = [];

        if (directiveName.length < 1) {
          throwError(state, 'directive name must not be less than one character in length');
        }

        while (ch !== 0) {
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }

          if (ch === 0x23/* # */) {
            do { ch = state.input.charCodeAt(++state.position); }
            while (ch !== 0 && !is_EOL(ch));
            break;
          }

          if (is_EOL(ch)) break;

          _position = state.position;

          while (ch !== 0 && !is_WS_OR_EOL(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }

          directiveArgs.push(state.input.slice(_position, state.position));
        }

        if (ch !== 0) readLineBreak(state);

        if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
          directiveHandlers[directiveName](state, directiveName, directiveArgs);
        } else {
          throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
      }

      skipSeparationSpace(state, true, -1);

      if (state.lineIndent === 0 &&
          state.input.charCodeAt(state.position)     === 0x2D/* - */ &&
          state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
          state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);

      } else if (hasDirectives) {
        throwError(state, 'directives end mark is expected');
      }

      composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
      skipSeparationSpace(state, true, -1);

      if (state.checkLineBreaks &&
          PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
        throwWarning(state, 'non-ASCII line breaks are interpreted as content');
      }

      state.documents.push(state.result);

      if (state.position === state.lineStart && testDocumentSeparator(state)) {

        if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
          state.position += 3;
          skipSeparationSpace(state, true, -1);
        }
        return;
      }

      if (state.position < (state.length - 1)) {
        throwError(state, 'end of the stream or a document separator is expected');
      } else {
        return;
      }
    }


    function loadDocuments(input, options) {
      input = String(input);
      options = options || {};

      if (input.length !== 0) {

        // Add tailing `\n` if not exists
        if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
            input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
          input += '\n';
        }

        // Strip BOM
        if (input.charCodeAt(0) === 0xFEFF) {
          input = input.slice(1);
        }
      }

      var state = new State$1(input, options);

      var nullpos = input.indexOf('\0');

      if (nullpos !== -1) {
        state.position = nullpos;
        throwError(state, 'null byte is not allowed in input');
      }

      // Use 0 as string terminator. That significantly simplifies bounds check.
      state.input += '\0';

      while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
        state.lineIndent += 1;
        state.position += 1;
      }

      while (state.position < (state.length - 1)) {
        readDocument(state);
      }

      return state.documents;
    }


    function loadAll$1(input, iterator, options) {
      if (iterator !== null && typeof iterator === 'object' && typeof options === 'undefined') {
        options = iterator;
        iterator = null;
      }

      var documents = loadDocuments(input, options);

      if (typeof iterator !== 'function') {
        return documents;
      }

      for (var index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
      }
    }


    function load$1(input, options) {
      var documents = loadDocuments(input, options);

      if (documents.length === 0) {
        /*eslint-disable no-undefined*/
        return undefined;
      } else if (documents.length === 1) {
        return documents[0];
      }
      throw new exception('expected a single document in the stream, but found more');
    }


    var loadAll_1 = loadAll$1;
    var load_1    = load$1;

    var loader = {
    	loadAll: loadAll_1,
    	load: load_1
    };

    /*eslint-disable no-use-before-define*/





    var _toString       = Object.prototype.toString;
    var _hasOwnProperty = Object.prototype.hasOwnProperty;

    var CHAR_BOM                  = 0xFEFF;
    var CHAR_TAB                  = 0x09; /* Tab */
    var CHAR_LINE_FEED            = 0x0A; /* LF */
    var CHAR_CARRIAGE_RETURN      = 0x0D; /* CR */
    var CHAR_SPACE                = 0x20; /* Space */
    var CHAR_EXCLAMATION          = 0x21; /* ! */
    var CHAR_DOUBLE_QUOTE         = 0x22; /* " */
    var CHAR_SHARP                = 0x23; /* # */
    var CHAR_PERCENT              = 0x25; /* % */
    var CHAR_AMPERSAND            = 0x26; /* & */
    var CHAR_SINGLE_QUOTE         = 0x27; /* ' */
    var CHAR_ASTERISK             = 0x2A; /* * */
    var CHAR_COMMA                = 0x2C; /* , */
    var CHAR_MINUS                = 0x2D; /* - */
    var CHAR_COLON                = 0x3A; /* : */
    var CHAR_EQUALS               = 0x3D; /* = */
    var CHAR_GREATER_THAN         = 0x3E; /* > */
    var CHAR_QUESTION             = 0x3F; /* ? */
    var CHAR_COMMERCIAL_AT        = 0x40; /* @ */
    var CHAR_LEFT_SQUARE_BRACKET  = 0x5B; /* [ */
    var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
    var CHAR_GRAVE_ACCENT         = 0x60; /* ` */
    var CHAR_LEFT_CURLY_BRACKET   = 0x7B; /* { */
    var CHAR_VERTICAL_LINE        = 0x7C; /* | */
    var CHAR_RIGHT_CURLY_BRACKET  = 0x7D; /* } */

    var ESCAPE_SEQUENCES = {};

    ESCAPE_SEQUENCES[0x00]   = '\\0';
    ESCAPE_SEQUENCES[0x07]   = '\\a';
    ESCAPE_SEQUENCES[0x08]   = '\\b';
    ESCAPE_SEQUENCES[0x09]   = '\\t';
    ESCAPE_SEQUENCES[0x0A]   = '\\n';
    ESCAPE_SEQUENCES[0x0B]   = '\\v';
    ESCAPE_SEQUENCES[0x0C]   = '\\f';
    ESCAPE_SEQUENCES[0x0D]   = '\\r';
    ESCAPE_SEQUENCES[0x1B]   = '\\e';
    ESCAPE_SEQUENCES[0x22]   = '\\"';
    ESCAPE_SEQUENCES[0x5C]   = '\\\\';
    ESCAPE_SEQUENCES[0x85]   = '\\N';
    ESCAPE_SEQUENCES[0xA0]   = '\\_';
    ESCAPE_SEQUENCES[0x2028] = '\\L';
    ESCAPE_SEQUENCES[0x2029] = '\\P';

    var DEPRECATED_BOOLEANS_SYNTAX = [
      'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
      'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
    ];

    var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;

    function compileStyleMap(schema, map) {
      var result, keys, index, length, tag, style, type;

      if (map === null) return {};

      result = {};
      keys = Object.keys(map);

      for (index = 0, length = keys.length; index < length; index += 1) {
        tag = keys[index];
        style = String(map[tag]);

        if (tag.slice(0, 2) === '!!') {
          tag = 'tag:yaml.org,2002:' + tag.slice(2);
        }
        type = schema.compiledTypeMap['fallback'][tag];

        if (type && _hasOwnProperty.call(type.styleAliases, style)) {
          style = type.styleAliases[style];
        }

        result[tag] = style;
      }

      return result;
    }

    function encodeHex(character) {
      var string, handle, length;

      string = character.toString(16).toUpperCase();

      if (character <= 0xFF) {
        handle = 'x';
        length = 2;
      } else if (character <= 0xFFFF) {
        handle = 'u';
        length = 4;
      } else if (character <= 0xFFFFFFFF) {
        handle = 'U';
        length = 8;
      } else {
        throw new exception('code point within a string may not be greater than 0xFFFFFFFF');
      }

      return '\\' + handle + common.repeat('0', length - string.length) + string;
    }


    var QUOTING_TYPE_SINGLE = 1,
        QUOTING_TYPE_DOUBLE = 2;

    function State(options) {
      this.schema        = options['schema'] || _default;
      this.indent        = Math.max(1, (options['indent'] || 2));
      this.noArrayIndent = options['noArrayIndent'] || false;
      this.skipInvalid   = options['skipInvalid'] || false;
      this.flowLevel     = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
      this.styleMap      = compileStyleMap(this.schema, options['styles'] || null);
      this.sortKeys      = options['sortKeys'] || false;
      this.lineWidth     = options['lineWidth'] || 80;
      this.noRefs        = options['noRefs'] || false;
      this.noCompatMode  = options['noCompatMode'] || false;
      this.condenseFlow  = options['condenseFlow'] || false;
      this.quotingType   = options['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
      this.forceQuotes   = options['forceQuotes'] || false;
      this.replacer      = typeof options['replacer'] === 'function' ? options['replacer'] : null;

      this.implicitTypes = this.schema.compiledImplicit;
      this.explicitTypes = this.schema.compiledExplicit;

      this.tag = null;
      this.result = '';

      this.duplicates = [];
      this.usedDuplicates = null;
    }

    // Indents every line in a string. Empty lines (\n only) are not indented.
    function indentString(string, spaces) {
      var ind = common.repeat(' ', spaces),
          position = 0,
          next = -1,
          result = '',
          line,
          length = string.length;

      while (position < length) {
        next = string.indexOf('\n', position);
        if (next === -1) {
          line = string.slice(position);
          position = length;
        } else {
          line = string.slice(position, next + 1);
          position = next + 1;
        }

        if (line.length && line !== '\n') result += ind;

        result += line;
      }

      return result;
    }

    function generateNextLine(state, level) {
      return '\n' + common.repeat(' ', state.indent * level);
    }

    function testImplicitResolving(state, str) {
      var index, length, type;

      for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        type = state.implicitTypes[index];

        if (type.resolve(str)) {
          return true;
        }
      }

      return false;
    }

    // [33] s-white ::= s-space | s-tab
    function isWhitespace(c) {
      return c === CHAR_SPACE || c === CHAR_TAB;
    }

    // Returns true if the character can be printed without escaping.
    // From YAML 1.2: "any allowed characters known to be non-printable
    // should also be escaped. [However,] This isn’t mandatory"
    // Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
    function isPrintable(c) {
      return  (0x00020 <= c && c <= 0x00007E)
          || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
          || ((0x0E000 <= c && c <= 0x00FFFD) && c !== CHAR_BOM)
          ||  (0x10000 <= c && c <= 0x10FFFF);
    }

    // [34] ns-char ::= nb-char - s-white
    // [27] nb-char ::= c-printable - b-char - c-byte-order-mark
    // [26] b-char  ::= b-line-feed | b-carriage-return
    // Including s-white (for some reason, examples doesn't match specs in this aspect)
    // ns-char ::= c-printable - b-line-feed - b-carriage-return - c-byte-order-mark
    function isNsCharOrWhitespace(c) {
      return isPrintable(c)
        && c !== CHAR_BOM
        // - b-char
        && c !== CHAR_CARRIAGE_RETURN
        && c !== CHAR_LINE_FEED;
    }

    // [127]  ns-plain-safe(c) ::= c = flow-out  ⇒ ns-plain-safe-out
    //                             c = flow-in   ⇒ ns-plain-safe-in
    //                             c = block-key ⇒ ns-plain-safe-out
    //                             c = flow-key  ⇒ ns-plain-safe-in
    // [128] ns-plain-safe-out ::= ns-char
    // [129]  ns-plain-safe-in ::= ns-char - c-flow-indicator
    // [130]  ns-plain-char(c) ::=  ( ns-plain-safe(c) - “:” - “#” )
    //                            | ( /* An ns-char preceding */ “#” )
    //                            | ( “:” /* Followed by an ns-plain-safe(c) */ )
    function isPlainSafe(c, prev, inblock) {
      var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
      var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
      return (
        // ns-plain-safe
        inblock ? // c = flow-in
          cIsNsCharOrWhitespace
          : cIsNsCharOrWhitespace
            // - c-flow-indicator
            && c !== CHAR_COMMA
            && c !== CHAR_LEFT_SQUARE_BRACKET
            && c !== CHAR_RIGHT_SQUARE_BRACKET
            && c !== CHAR_LEFT_CURLY_BRACKET
            && c !== CHAR_RIGHT_CURLY_BRACKET
      )
        // ns-plain-char
        && c !== CHAR_SHARP // false on '#'
        && !(prev === CHAR_COLON && !cIsNsChar) // false on ': '
        || (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) // change to true on '[^ ]#'
        || (prev === CHAR_COLON && cIsNsChar); // change to true on ':[^ ]'
    }

    // Simplified test for values allowed as the first character in plain style.
    function isPlainSafeFirst(c) {
      // Uses a subset of ns-char - c-indicator
      // where ns-char = nb-char - s-white.
      // No support of ( ( “?” | “:” | “-” ) /* Followed by an ns-plain-safe(c)) */ ) part
      return isPrintable(c) && c !== CHAR_BOM
        && !isWhitespace(c) // - s-white
        // - (c-indicator ::=
        // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
        && c !== CHAR_MINUS
        && c !== CHAR_QUESTION
        && c !== CHAR_COLON
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
        // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
        && c !== CHAR_SHARP
        && c !== CHAR_AMPERSAND
        && c !== CHAR_ASTERISK
        && c !== CHAR_EXCLAMATION
        && c !== CHAR_VERTICAL_LINE
        && c !== CHAR_EQUALS
        && c !== CHAR_GREATER_THAN
        && c !== CHAR_SINGLE_QUOTE
        && c !== CHAR_DOUBLE_QUOTE
        // | “%” | “@” | “`”)
        && c !== CHAR_PERCENT
        && c !== CHAR_COMMERCIAL_AT
        && c !== CHAR_GRAVE_ACCENT;
    }

    // Simplified test for values allowed as the last character in plain style.
    function isPlainSafeLast(c) {
      // just not whitespace or colon, it will be checked to be plain character later
      return !isWhitespace(c) && c !== CHAR_COLON;
    }

    // Same as 'string'.codePointAt(pos), but works in older browsers.
    function codePointAt(string, pos) {
      var first = string.charCodeAt(pos), second;
      if (first >= 0xD800 && first <= 0xDBFF && pos + 1 < string.length) {
        second = string.charCodeAt(pos + 1);
        if (second >= 0xDC00 && second <= 0xDFFF) {
          // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
          return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
        }
      }
      return first;
    }

    // Determines whether block indentation indicator is required.
    function needIndentIndicator(string) {
      var leadingSpaceRe = /^\n* /;
      return leadingSpaceRe.test(string);
    }

    var STYLE_PLAIN   = 1,
        STYLE_SINGLE  = 2,
        STYLE_LITERAL = 3,
        STYLE_FOLDED  = 4,
        STYLE_DOUBLE  = 5;

    // Determines which scalar styles are possible and returns the preferred style.
    // lineWidth = -1 => no limit.
    // Pre-conditions: str.length > 0.
    // Post-conditions:
    //    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
    //    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
    //    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
    function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth,
      testAmbiguousType, quotingType, forceQuotes, inblock) {

      var i;
      var char = 0;
      var prevChar = null;
      var hasLineBreak = false;
      var hasFoldableLine = false; // only checked if shouldTrackWidth
      var shouldTrackWidth = lineWidth !== -1;
      var previousLineBreak = -1; // count the first line correctly
      var plain = isPlainSafeFirst(codePointAt(string, 0))
              && isPlainSafeLast(codePointAt(string, string.length - 1));

      if (singleLineOnly || forceQuotes) {
        // Case: no block styles.
        // Check for disallowed characters to rule out plain and single.
        for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
      } else {
        // Case: block styles permitted.
        for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (char === CHAR_LINE_FEED) {
            hasLineBreak = true;
            // Check if any line can be folded.
            if (shouldTrackWidth) {
              hasFoldableLine = hasFoldableLine ||
                // Foldable line = too long, and not more-indented.
                (i - previousLineBreak - 1 > lineWidth &&
                 string[previousLineBreak + 1] !== ' ');
              previousLineBreak = i;
            }
          } else if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
        // in case the end is missing a \n
        hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
          (i - previousLineBreak - 1 > lineWidth &&
           string[previousLineBreak + 1] !== ' '));
      }
      // Although every style can represent \n without escaping, prefer block styles
      // for multiline, since they're more readable and they don't add empty lines.
      // Also prefer folding a super-long line.
      if (!hasLineBreak && !hasFoldableLine) {
        // Strings interpretable as another type have to be quoted;
        // e.g. the string 'true' vs. the boolean true.
        if (plain && !forceQuotes && !testAmbiguousType(string)) {
          return STYLE_PLAIN;
        }
        return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
      }
      // Edge case: block indentation indicator can only have one digit.
      if (indentPerLevel > 9 && needIndentIndicator(string)) {
        return STYLE_DOUBLE;
      }
      // At this point we know block styles are valid.
      // Prefer literal style unless we want to fold.
      if (!forceQuotes) {
        return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }

    // Note: line breaking/folding is implemented for only the folded style.
    // NB. We drop the last trailing newline (if any) of a returned block scalar
    //  since the dumper adds its own newline. This always works:
    //    • No ending newline => unaffected; already using strip "-" chomping.
    //    • Ending newline    => removed then restored.
    //  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
    function writeScalar(state, string, level, iskey, inblock) {
      state.dump = (function () {
        if (string.length === 0) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
        }
        if (!state.noCompatMode) {
          if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
            return state.quotingType === QUOTING_TYPE_DOUBLE ? ('"' + string + '"') : ("'" + string + "'");
          }
        }

        var indent = state.indent * Math.max(1, level); // no 0-indent scalars
        // As indentation gets deeper, let the width decrease monotonically
        // to the lower bound min(state.lineWidth, 40).
        // Note that this implies
        //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
        //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
        // This behaves better than a constant minimum width which disallows narrower options,
        // or an indent threshold which causes the width to suddenly increase.
        var lineWidth = state.lineWidth === -1
          ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

        // Without knowing if keys are implicit/explicit, assume implicit for safety.
        var singleLineOnly = iskey
          // No block styles in flow mode.
          || (state.flowLevel > -1 && level >= state.flowLevel);
        function testAmbiguity(string) {
          return testImplicitResolving(state, string);
        }

        switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth,
          testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {

          case STYLE_PLAIN:
            return string;
          case STYLE_SINGLE:
            return "'" + string.replace(/'/g, "''") + "'";
          case STYLE_LITERAL:
            return '|' + blockHeader(string, state.indent)
              + dropEndingNewline(indentString(string, indent));
          case STYLE_FOLDED:
            return '>' + blockHeader(string, state.indent)
              + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
          case STYLE_DOUBLE:
            return '"' + escapeString(string) + '"';
          default:
            throw new exception('impossible error: invalid scalar style');
        }
      }());
    }

    // Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
    function blockHeader(string, indentPerLevel) {
      var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';

      // note the special case: the string '\n' counts as a "trailing" empty line.
      var clip =          string[string.length - 1] === '\n';
      var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
      var chomp = keep ? '+' : (clip ? '' : '-');

      return indentIndicator + chomp + '\n';
    }

    // (See the note for writeScalar.)
    function dropEndingNewline(string) {
      return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
    }

    // Note: a long line without a suitable break point will exceed the width limit.
    // Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
    function foldString(string, width) {
      // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
      // unless they're before or after a more-indented line, or at the very
      // beginning or end, in which case $k$ maps to $k$.
      // Therefore, parse each chunk as newline(s) followed by a content line.
      var lineRe = /(\n+)([^\n]*)/g;

      // first line (possibly an empty line)
      var result = (function () {
        var nextLF = string.indexOf('\n');
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
      }());
      // If we haven't reached the first content line yet, don't add an extra \n.
      var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
      var moreIndented;

      // rest of the lines
      var match;
      while ((match = lineRe.exec(string))) {
        var prefix = match[1], line = match[2];
        moreIndented = (line[0] === ' ');
        result += prefix
          + (!prevMoreIndented && !moreIndented && line !== ''
            ? '\n' : '')
          + foldLine(line, width);
        prevMoreIndented = moreIndented;
      }

      return result;
    }

    // Greedy line breaking.
    // Picks the longest line under the limit each time,
    // otherwise settles for the shortest line over the limit.
    // NB. More-indented lines *cannot* be folded, as that would add an extra \n.
    function foldLine(line, width) {
      if (line === '' || line[0] === ' ') return line;

      // Since a more-indented line adds a \n, breaks can't be followed by a space.
      var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
      var match;
      // start is an inclusive index. end, curr, and next are exclusive.
      var start = 0, end, curr = 0, next = 0;
      var result = '';

      // Invariants: 0 <= start <= length-1.
      //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
      // Inside the loop:
      //   A match implies length >= 2, so curr and next are <= length-2.
      while ((match = breakRe.exec(line))) {
        next = match.index;
        // maintain invariant: curr - start <= width
        if (next - start > width) {
          end = (curr > start) ? curr : next; // derive end <= length-2
          result += '\n' + line.slice(start, end);
          // skip the space that was output as \n
          start = end + 1;                    // derive start <= length-1
        }
        curr = next;
      }

      // By the invariants, start <= length-1, so there is something left over.
      // It is either the whole string or a part starting from non-whitespace.
      result += '\n';
      // Insert a break if the remainder is too long and there is a break available.
      if (line.length - start > width && curr > start) {
        result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
      } else {
        result += line.slice(start);
      }

      return result.slice(1); // drop extra \n joiner
    }

    // Escapes a double-quoted string.
    function escapeString(string) {
      var result = '';
      var char = 0;
      var escapeSeq;

      for (var i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
        char = codePointAt(string, i);
        escapeSeq = ESCAPE_SEQUENCES[char];

        if (!escapeSeq && isPrintable(char)) {
          result += string[i];
          if (char >= 0x10000) result += string[i + 1];
        } else {
          result += escapeSeq || encodeHex(char);
        }
      }

      return result;
    }

    function writeFlowSequence(state, level, object) {
      var _result = '',
          _tag    = state.tag,
          index,
          length,
          value;

      for (index = 0, length = object.length; index < length; index += 1) {
        value = object[index];

        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }

        // Write only valid elements, put null instead of invalid elements.
        if (writeNode(state, level, value, false, false) ||
            (typeof value === 'undefined' &&
             writeNode(state, level, null, false, false))) {

          if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
          _result += state.dump;
        }
      }

      state.tag = _tag;
      state.dump = '[' + _result + ']';
    }

    function writeBlockSequence(state, level, object, compact) {
      var _result = '',
          _tag    = state.tag,
          index,
          length,
          value;

      for (index = 0, length = object.length; index < length; index += 1) {
        value = object[index];

        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }

        // Write only valid elements, put null instead of invalid elements.
        if (writeNode(state, level + 1, value, true, true, false, true) ||
            (typeof value === 'undefined' &&
             writeNode(state, level + 1, null, true, true, false, true))) {

          if (!compact || _result !== '') {
            _result += generateNextLine(state, level);
          }

          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            _result += '-';
          } else {
            _result += '- ';
          }

          _result += state.dump;
        }
      }

      state.tag = _tag;
      state.dump = _result || '[]'; // Empty sequence if no valid values.
    }

    function writeFlowMapping(state, level, object) {
      var _result       = '',
          _tag          = state.tag,
          objectKeyList = Object.keys(object),
          index,
          length,
          objectKey,
          objectValue,
          pairBuffer;

      for (index = 0, length = objectKeyList.length; index < length; index += 1) {

        pairBuffer = '';
        if (_result !== '') pairBuffer += ', ';

        if (state.condenseFlow) pairBuffer += '"';

        objectKey = objectKeyList[index];
        objectValue = object[objectKey];

        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }

        if (!writeNode(state, level, objectKey, false, false)) {
          continue; // Skip this pair because of invalid key;
        }

        if (state.dump.length > 1024) pairBuffer += '? ';

        pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

        if (!writeNode(state, level, objectValue, false, false)) {
          continue; // Skip this pair because of invalid value.
        }

        pairBuffer += state.dump;

        // Both key and value are valid.
        _result += pairBuffer;
      }

      state.tag = _tag;
      state.dump = '{' + _result + '}';
    }

    function writeBlockMapping(state, level, object, compact) {
      var _result       = '',
          _tag          = state.tag,
          objectKeyList = Object.keys(object),
          index,
          length,
          objectKey,
          objectValue,
          explicitPair,
          pairBuffer;

      // Allow sorting keys so that the output file is deterministic
      if (state.sortKeys === true) {
        // Default sorting
        objectKeyList.sort();
      } else if (typeof state.sortKeys === 'function') {
        // Custom sort function
        objectKeyList.sort(state.sortKeys);
      } else if (state.sortKeys) {
        // Something is wrong
        throw new exception('sortKeys must be a boolean or a function');
      }

      for (index = 0, length = objectKeyList.length; index < length; index += 1) {
        pairBuffer = '';

        if (!compact || _result !== '') {
          pairBuffer += generateNextLine(state, level);
        }

        objectKey = objectKeyList[index];
        objectValue = object[objectKey];

        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }

        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
          continue; // Skip this pair because of invalid key.
        }

        explicitPair = (state.tag !== null && state.tag !== '?') ||
                       (state.dump && state.dump.length > 1024);

        if (explicitPair) {
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += '?';
          } else {
            pairBuffer += '? ';
          }
        }

        pairBuffer += state.dump;

        if (explicitPair) {
          pairBuffer += generateNextLine(state, level);
        }

        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
          continue; // Skip this pair because of invalid value.
        }

        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += ':';
        } else {
          pairBuffer += ': ';
        }

        pairBuffer += state.dump;

        // Both key and value are valid.
        _result += pairBuffer;
      }

      state.tag = _tag;
      state.dump = _result || '{}'; // Empty mapping if no valid pairs.
    }

    function detectType(state, object, explicit) {
      var _result, typeList, index, length, type, style;

      typeList = explicit ? state.explicitTypes : state.implicitTypes;

      for (index = 0, length = typeList.length; index < length; index += 1) {
        type = typeList[index];

        if ((type.instanceOf  || type.predicate) &&
            (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
            (!type.predicate  || type.predicate(object))) {

          if (explicit) {
            if (type.multi && type.representName) {
              state.tag = type.representName(object);
            } else {
              state.tag = type.tag;
            }
          } else {
            state.tag = '?';
          }

          if (type.represent) {
            style = state.styleMap[type.tag] || type.defaultStyle;

            if (_toString.call(type.represent) === '[object Function]') {
              _result = type.represent(object, style);
            } else if (_hasOwnProperty.call(type.represent, style)) {
              _result = type.represent[style](object, style);
            } else {
              throw new exception('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
            }

            state.dump = _result;
          }

          return true;
        }
      }

      return false;
    }

    // Serializes `object` and writes it to global `result`.
    // Returns true on success, or false on invalid object.
    //
    function writeNode(state, level, object, block, compact, iskey, isblockseq) {
      state.tag = null;
      state.dump = object;

      if (!detectType(state, object, false)) {
        detectType(state, object, true);
      }

      var type = _toString.call(state.dump);
      var inblock = block;
      var tagStr;

      if (block) {
        block = (state.flowLevel < 0 || state.flowLevel > level);
      }

      var objectOrArray = type === '[object Object]' || type === '[object Array]',
          duplicateIndex,
          duplicate;

      if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
      }

      if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
        compact = false;
      }

      if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = '*ref_' + duplicateIndex;
      } else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
          state.usedDuplicates[duplicateIndex] = true;
        }
        if (type === '[object Object]') {
          if (block && (Object.keys(state.dump).length !== 0)) {
            writeBlockMapping(state, level, state.dump, compact);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + state.dump;
            }
          } else {
            writeFlowMapping(state, level, state.dump);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
            }
          }
        } else if (type === '[object Array]') {
          if (block && (state.dump.length !== 0)) {
            if (state.noArrayIndent && !isblockseq && level > 0) {
              writeBlockSequence(state, level - 1, state.dump, compact);
            } else {
              writeBlockSequence(state, level, state.dump, compact);
            }
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + state.dump;
            }
          } else {
            writeFlowSequence(state, level, state.dump);
            if (duplicate) {
              state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
            }
          }
        } else if (type === '[object String]') {
          if (state.tag !== '?') {
            writeScalar(state, state.dump, level, iskey, inblock);
          }
        } else if (type === '[object Undefined]') {
          return false;
        } else {
          if (state.skipInvalid) return false;
          throw new exception('unacceptable kind of an object to dump ' + type);
        }

        if (state.tag !== null && state.tag !== '?') {
          // Need to encode all characters except those allowed by the spec:
          //
          // [35] ns-dec-digit    ::=  [#x30-#x39] /* 0-9 */
          // [36] ns-hex-digit    ::=  ns-dec-digit
          //                         | [#x41-#x46] /* A-F */ | [#x61-#x66] /* a-f */
          // [37] ns-ascii-letter ::=  [#x41-#x5A] /* A-Z */ | [#x61-#x7A] /* a-z */
          // [38] ns-word-char    ::=  ns-dec-digit | ns-ascii-letter | “-”
          // [39] ns-uri-char     ::=  “%” ns-hex-digit ns-hex-digit | ns-word-char | “#”
          //                         | “;” | “/” | “?” | “:” | “@” | “&” | “=” | “+” | “$” | “,”
          //                         | “_” | “.” | “!” | “~” | “*” | “'” | “(” | “)” | “[” | “]”
          //
          // Also need to encode '!' because it has special meaning (end of tag prefix).
          //
          tagStr = encodeURI(
            state.tag[0] === '!' ? state.tag.slice(1) : state.tag
          ).replace(/!/g, '%21');

          if (state.tag[0] === '!') {
            tagStr = '!' + tagStr;
          } else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') {
            tagStr = '!!' + tagStr.slice(18);
          } else {
            tagStr = '!<' + tagStr + '>';
          }

          state.dump = tagStr + ' ' + state.dump;
        }
      }

      return true;
    }

    function getDuplicateReferences(object, state) {
      var objects = [],
          duplicatesIndexes = [],
          index,
          length;

      inspectNode(object, objects, duplicatesIndexes);

      for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
      }
      state.usedDuplicates = new Array(length);
    }

    function inspectNode(object, objects, duplicatesIndexes) {
      var objectKeyList,
          index,
          length;

      if (object !== null && typeof object === 'object') {
        index = objects.indexOf(object);
        if (index !== -1) {
          if (duplicatesIndexes.indexOf(index) === -1) {
            duplicatesIndexes.push(index);
          }
        } else {
          objects.push(object);

          if (Array.isArray(object)) {
            for (index = 0, length = object.length; index < length; index += 1) {
              inspectNode(object[index], objects, duplicatesIndexes);
            }
          } else {
            objectKeyList = Object.keys(object);

            for (index = 0, length = objectKeyList.length; index < length; index += 1) {
              inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
            }
          }
        }
      }
    }

    function dump$1(input, options) {
      options = options || {};

      var state = new State(options);

      if (!state.noRefs) getDuplicateReferences(input, state);

      var value = input;

      if (state.replacer) {
        value = state.replacer.call({ '': value }, '', value);
      }

      if (writeNode(state, 0, value, true, true)) return state.dump + '\n';

      return '';
    }

    var dump_1 = dump$1;

    var dumper = {
    	dump: dump_1
    };

    function renamed(from, to) {
      return function () {
        throw new Error('Function yaml.' + from + ' is removed in js-yaml 4. ' +
          'Use yaml.' + to + ' instead, which is now safe by default.');
      };
    }


    var Type                = type;
    var Schema              = schema;
    var FAILSAFE_SCHEMA     = failsafe;
    var JSON_SCHEMA         = json;
    var CORE_SCHEMA         = core;
    var DEFAULT_SCHEMA      = _default;
    var load                = loader.load;
    var loadAll             = loader.loadAll;
    var dump                = dumper.dump;
    var YAMLException       = exception;

    // Re-export all types in case user wants to create custom schema
    var types = {
      binary:    binary,
      float:     float,
      map:       map,
      null:      _null,
      pairs:     pairs,
      set:       set,
      timestamp: timestamp,
      bool:      bool,
      int:       int,
      merge:     merge,
      omap:      omap,
      seq:       seq,
      str:       str
    };

    // Removed functions from JS-YAML 3.0.x
    var safeLoad            = renamed('safeLoad', 'load');
    var safeLoadAll         = renamed('safeLoadAll', 'loadAll');
    var safeDump            = renamed('safeDump', 'dump');

    var jsYaml = {
    	Type: Type,
    	Schema: Schema,
    	FAILSAFE_SCHEMA: FAILSAFE_SCHEMA,
    	JSON_SCHEMA: JSON_SCHEMA,
    	CORE_SCHEMA: CORE_SCHEMA,
    	DEFAULT_SCHEMA: DEFAULT_SCHEMA,
    	load: load,
    	loadAll: loadAll,
    	dump: dump,
    	YAMLException: YAMLException,
    	types: types,
    	safeLoad: safeLoad,
    	safeLoadAll: safeLoadAll,
    	safeDump: safeDump
    };

    function parseFromYaml(yamlString) {
      try {
        const doc = jsYaml.load(yamlString);
        return doc;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    function parseToYaml(data) {
      try {
        const doc = jsYaml.dump(data);
        return doc;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    // Copyright 2019-2024 Tauri Programme within The Commons Conservancy
    // SPDX-License-Identifier: Apache-2.0
    // SPDX-License-Identifier: MIT
    /**
     * The path module provides utilities for working with file and directory paths.
     *
     * This package is also accessible with `window.__TAURI__.path` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
     *
     * It is recommended to allowlist only the APIs you use for optimal bundle size and security.
     * @module
     */
    /**
     * @since 2.0.0
     */
    var BaseDirectory;
    (function (BaseDirectory) {
        /**
         * @see {@link audioDir} for more information.
         */
        BaseDirectory[BaseDirectory["Audio"] = 1] = "Audio";
        /**
         * @see {@link cacheDir} for more information.
         */
        BaseDirectory[BaseDirectory["Cache"] = 2] = "Cache";
        /**
         * @see {@link configDir} for more information.
         */
        BaseDirectory[BaseDirectory["Config"] = 3] = "Config";
        /**
         * @see {@link dataDir} for more information.
         */
        BaseDirectory[BaseDirectory["Data"] = 4] = "Data";
        /**
         * @see {@link localDataDir} for more information.
         */
        BaseDirectory[BaseDirectory["LocalData"] = 5] = "LocalData";
        /**
         * @see {@link documentDir} for more information.
         */
        BaseDirectory[BaseDirectory["Document"] = 6] = "Document";
        /**
         * @see {@link downloadDir} for more information.
         */
        BaseDirectory[BaseDirectory["Download"] = 7] = "Download";
        /**
         * @see {@link pictureDir} for more information.
         */
        BaseDirectory[BaseDirectory["Picture"] = 8] = "Picture";
        /**
         * @see {@link publicDir} for more information.
         */
        BaseDirectory[BaseDirectory["Public"] = 9] = "Public";
        /**
         * @see {@link videoDir} for more information.
         */
        BaseDirectory[BaseDirectory["Video"] = 10] = "Video";
        /**
         * @see {@link resourceDir} for more information.
         */
        BaseDirectory[BaseDirectory["Resource"] = 11] = "Resource";
        /**
         * @see {@link tempDir} for more information.
         */
        BaseDirectory[BaseDirectory["Temp"] = 12] = "Temp";
        /**
         * @see {@link appConfigDir} for more information.
         */
        BaseDirectory[BaseDirectory["AppConfig"] = 13] = "AppConfig";
        /**
         * @see {@link appDataDir} for more information.
         */
        BaseDirectory[BaseDirectory["AppData"] = 14] = "AppData";
        /**
         * @see {@link appLocalDataDir} for more information.
         */
        BaseDirectory[BaseDirectory["AppLocalData"] = 15] = "AppLocalData";
        /**
         * @see {@link appCacheDir} for more information.
         */
        BaseDirectory[BaseDirectory["AppCache"] = 16] = "AppCache";
        /**
         * @see {@link appLogDir} for more information.
         */
        BaseDirectory[BaseDirectory["AppLog"] = 17] = "AppLog";
        /**
         * @see {@link desktopDir} for more information.
         */
        BaseDirectory[BaseDirectory["Desktop"] = 18] = "Desktop";
        /**
         * @see {@link executableDir} for more information.
         */
        BaseDirectory[BaseDirectory["Executable"] = 19] = "Executable";
        /**
         * @see {@link fontDir} for more information.
         */
        BaseDirectory[BaseDirectory["Font"] = 20] = "Font";
        /**
         * @see {@link homeDir} for more information.
         */
        BaseDirectory[BaseDirectory["Home"] = 21] = "Home";
        /**
         * @see {@link runtimeDir} for more information.
         */
        BaseDirectory[BaseDirectory["Runtime"] = 22] = "Runtime";
        /**
         * @see {@link templateDir} for more information.
         */
        BaseDirectory[BaseDirectory["Template"] = 23] = "Template";
    })(BaseDirectory || (BaseDirectory = {}));

    // Copyright 2019-2023 Tauri Programme within The Commons Conservancy
    // SPDX-License-Identifier: Apache-2.0
    // SPDX-License-Identifier: MIT
    /**
     * Access the file system.
     *
     * ## Security
     *
     * This module prevents path traversal, not allowing parent directory accessors to be used
     * (i.e. "/usr/path/to/../file" or "../path/to/file" paths are not allowed).
     * Paths accessed with this API must be either relative to one of the {@link BaseDirectory | base directories}
     * or created with the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/ | path API}.
     *
     * The API has a scope configuration that forces you to restrict the paths that can be accessed using glob patterns.
     *
     * The scope configuration is an array of glob patterns describing file/directory paths that are allowed.
     * For instance, this scope configuration allows **all** enabled `fs` APIs to (only) access files in the
     * *databases* directory of the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | `$APPDATA` directory}:
     * ```json
     * {
     *   "permissions": [
     *     {
     *       "identifier": "fs:scope",
     *       "allow": [{ "path": "$APPDATA/databases/*" }]
     *     }
     *   ]
     * }
     * ```
     *
     * Scopes can also be applied to specific `fs` APIs by using the API's identifier instead of `fs:scope`:
     * ```json
     * {
     *   "permissions": [
     *     {
     *       "identifier": "fs:allow-exists",
     *       "allow": [{ "path": "$APPDATA/databases/*" }]
     *     }
     *   ]
     * }
     * ```
     *
     * Notice the use of the `$APPDATA` variable. The value is injected at runtime, resolving to the {@link https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | app data directory}.
     *
     * The available variables are:
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appconfigdir | $APPCONFIG},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appdatadir | $APPDATA},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#applocaldatadir | $APPLOCALDATA},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#appcachedir | $APPCACHE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#applogdir | $APPLOG},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#audiodir | $AUDIO},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#cachedir | $CACHE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#configdir | $CONFIG},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#datadir | $DATA},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#localdatadir | $LOCALDATA},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#desktopdir | $DESKTOP},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#documentdir | $DOCUMENT},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#downloaddir | $DOWNLOAD},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#executabledir | $EXE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#fontdir | $FONT},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#homedir | $HOME},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#picturedir | $PICTURE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#publicdir | $PUBLIC},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#runtimedir | $RUNTIME},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#templatedir | $TEMPLATE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#videodir | $VIDEO},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#resourcedir | $RESOURCE},
     * {@linkcode https://v2.tauri.app/reference/javascript/api/namespacepath/#tempdir | $TEMP}.
     *
     * Trying to execute any API with a URL not configured on the scope results in a promise rejection due to denied access.
     *
     * @module
     */
    var SeekMode;
    (function (SeekMode) {
        SeekMode[SeekMode["Start"] = 0] = "Start";
        SeekMode[SeekMode["Current"] = 1] = "Current";
        SeekMode[SeekMode["End"] = 2] = "End";
    })(SeekMode || (SeekMode = {}));
    function parseFileInfo(r) {
        return {
            isFile: r.isFile,
            isDirectory: r.isDirectory,
            isSymlink: r.isSymlink,
            size: r.size,
            mtime: r.mtime !== null ? new Date(r.mtime) : null,
            atime: r.atime !== null ? new Date(r.atime) : null,
            birthtime: r.birthtime !== null ? new Date(r.birthtime) : null,
            readonly: r.readonly,
            fileAttributes: r.fileAttributes,
            dev: r.dev,
            ino: r.ino,
            mode: r.mode,
            nlink: r.nlink,
            uid: r.uid,
            gid: r.gid,
            rdev: r.rdev,
            blksize: r.blksize,
            blocks: r.blocks
        };
    }
    // https://gist.github.com/zapthedingbat/38ebfbedd98396624e5b5f2ff462611d
    /** Converts a big-endian eight byte array to number  */
    function fromBytes(buffer) {
        const bytes = new Uint8ClampedArray(buffer);
        const size = bytes.byteLength;
        let x = 0;
        for (let i = 0; i < size; i++) {
            // eslint-disable-next-line security/detect-object-injection
            const byte = bytes[i];
            x *= 0x100;
            x += byte;
        }
        return x;
    }
    /**
     *  The Tauri abstraction for reading and writing files.
     *
     * @since 2.0.0
     */
    class FileHandle extends Resource {
        /**
         * Reads up to `p.byteLength` bytes into `p`. It resolves to the number of
         * bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error
         * encountered. Even if `read()` resolves to `n` < `p.byteLength`, it may
         * use all of `p` as scratch space during the call. If some data is
         * available but not `p.byteLength` bytes, `read()` conventionally resolves
         * to what is available instead of waiting for more.
         *
         * When `read()` encounters end-of-file condition, it resolves to EOF
         * (`null`).
         *
         * When `read()` encounters an error, it rejects with an error.
         *
         * Callers should always process the `n` > `0` bytes returned before
         * considering the EOF (`null`). Doing so correctly handles I/O errors that
         * happen after reading some bytes and also both of the allowed EOF
         * behaviors.
         *
         * @example
         * ```typescript
         * import { open, BaseDirectory } from "@tauri-apps/plugin-fs"
         * // if "$APPCONFIG/foo/bar.txt" contains the text "hello world":
         * const file = await open("foo/bar.txt", { baseDir: BaseDirectory.AppConfig });
         * const buf = new Uint8Array(100);
         * const numberOfBytesRead = await file.read(buf); // 11 bytes
         * const text = new TextDecoder().decode(buf);  // "hello world"
         * await file.close();
         * ```
         *
         * @since 2.0.0
         */
        async read(buffer) {
            if (buffer.byteLength === 0) {
                return 0;
            }
            const data = await invoke('plugin:fs|read', {
                rid: this.rid,
                len: buffer.byteLength
            });
            // Rust side will never return an empty array for this command and
            // ensure there is at least 8 elements there.
            //
            // This is an optimization to include the number of read bytes (as bigendian bytes)
            // at the end of returned array to avoid serialization overhead of separate values.
            const nread = fromBytes(data.slice(-8));
            const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
            buffer.set(bytes.slice(0, bytes.length - 8));
            return nread === 0 ? null : nread;
        }
        /**
         * Seek sets the offset for the next `read()` or `write()` to offset,
         * interpreted according to `whence`: `Start` means relative to the
         * start of the file, `Current` means relative to the current offset,
         * and `End` means relative to the end. Seek resolves to the new offset
         * relative to the start of the file.
         *
         * Seeking to an offset before the start of the file is an error. Seeking to
         * any positive offset is legal, but the behavior of subsequent I/O
         * operations on the underlying object is implementation-dependent.
         * It returns the number of cursor position.
         *
         * @example
         * ```typescript
         * import { open, SeekMode, BaseDirectory } from '@tauri-apps/plugin-fs';
         *
         * // Given hello.txt pointing to file with "Hello world", which is 11 bytes long:
         * const file = await open('hello.txt', { read: true, write: true, truncate: true, create: true, baseDir: BaseDirectory.AppLocalData });
         * await file.write(new TextEncoder().encode("Hello world"));
         *
         * // Seek 6 bytes from the start of the file
         * console.log(await file.seek(6, SeekMode.Start)); // "6"
         * // Seek 2 more bytes from the current position
         * console.log(await file.seek(2, SeekMode.Current)); // "8"
         * // Seek backwards 2 bytes from the end of the file
         * console.log(await file.seek(-2, SeekMode.End)); // "9" (e.g. 11-2)
         *
         * await file.close();
         * ```
         *
         * @since 2.0.0
         */
        async seek(offset, whence) {
            return await invoke('plugin:fs|seek', {
                rid: this.rid,
                offset,
                whence
            });
        }
        /**
         * Returns a {@linkcode FileInfo } for this file.
         *
         * @example
         * ```typescript
         * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
         * const file = await open("file.txt", { read: true, baseDir: BaseDirectory.AppLocalData });
         * const fileInfo = await file.stat();
         * console.log(fileInfo.isFile); // true
         * await file.close();
         * ```
         *
         * @since 2.0.0
         */
        async stat() {
            const res = await invoke('plugin:fs|fstat', {
                rid: this.rid
            });
            return parseFileInfo(res);
        }
        /**
         * Truncates or extends this file, to reach the specified `len`.
         * If `len` is not specified then the entire file contents are truncated.
         *
         * @example
         * ```typescript
         * import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
         *
         * // truncate the entire file
         * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
         * await file.truncate();
         *
         * // truncate part of the file
         * const file = await open("my_file.txt", { read: true, write: true, create: true, baseDir: BaseDirectory.AppLocalData });
         * await file.write(new TextEncoder().encode("Hello World"));
         * await file.truncate(7);
         * const data = new Uint8Array(32);
         * await file.read(data);
         * console.log(new TextDecoder().decode(data)); // Hello W
         * await file.close();
         * ```
         *
         * @since 2.0.0
         */
        async truncate(len) {
            await invoke('plugin:fs|ftruncate', {
                rid: this.rid,
                len
            });
        }
        /**
         * Writes `data.byteLength` bytes from `data` to the underlying data stream. It
         * resolves to the number of bytes written from `data` (`0` <= `n` <=
         * `data.byteLength`) or reject with the error encountered that caused the
         * write to stop early. `write()` must reject with a non-null error if
         * would resolve to `n` < `data.byteLength`. `write()` must not modify the
         * slice data, even temporarily.
         *
         * @example
         * ```typescript
         * import { open, write, BaseDirectory } from '@tauri-apps/plugin-fs';
         * const encoder = new TextEncoder();
         * const data = encoder.encode("Hello world");
         * const file = await open("bar.txt", { write: true, baseDir: BaseDirectory.AppLocalData });
         * const bytesWritten = await file.write(data); // 11
         * await file.close();
         * ```
         *
         * @since 2.0.0
         */
        async write(data) {
            return await invoke('plugin:fs|write', {
                rid: this.rid,
                data
            });
        }
    }
    /**
     * Creates a file if none exists or truncates an existing file and resolves to
     *  an instance of {@linkcode FileHandle }.
     *
     * @example
     * ```typescript
     * import { create, BaseDirectory } from "@tauri-apps/plugin-fs"
     * const file = await create("foo/bar.txt", { baseDir: BaseDirectory.AppConfig });
     * await file.write(new TextEncoder().encode("Hello world"));
     * await file.close();
     * ```
     *
     * @since 2.0.0
     */
    async function create(path, options) {
        if (path instanceof URL && path.protocol !== 'file:') {
            throw new TypeError('Must be a file URL.');
        }
        const rid = await invoke('plugin:fs|create', {
            path: path instanceof URL ? path.toString() : path,
            options
        });
        return new FileHandle(rid);
    }
    /**
     * Reads and returns the entire contents of a file as UTF-8 string.
     * @example
     * ```typescript
     * import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
     * const contents = await readTextFile('app.conf', { baseDir: BaseDirectory.AppConfig });
     * ```
     *
     * @since 2.0.0
     */
    async function readTextFile(path, options) {
        if (path instanceof URL && path.protocol !== 'file:') {
            throw new TypeError('Must be a file URL.');
        }
        const arr = await invoke('plugin:fs|read_text_file', {
            path: path instanceof URL ? path.toString() : path,
            options
        });
        const bytes = arr instanceof ArrayBuffer ? arr : Uint8Array.from(arr);
        return new TextDecoder().decode(bytes);
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { Error: Error$, Map: Map$, Object: Object$, console: console$ } = globals;

    const file$ = "src/App.svelte";

    function get_each_context$(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	child_ctx[49] = i;
    	return child_ctx;
    }

    function get_each_context$_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[50] = list[i];
    	child_ctx[51] = list;
    	child_ctx[52] = i;
    	return child_ctx;
    }

    // (1084:8) {#if inspectorNode}
    function create_if_block$_1(ctx) {
    	let if_block$_anchor$;

    	function select_block_type$(ctx, dirty) {
    		if (/*inspectorNode*/ ctx[8].role === "input") return create_if_block$_2;
    		if (/*inspectorNode*/ ctx[8].role === "output") return create_if_block$_3;
    		return create_else_block$;
    	}

    	let current_block_type$ = select_block_type$(ctx);
    	let if_block$ = current_block_type$(ctx);

    	const block$ = {
    		c: function create() {
    			if_block$.c();
    			if_block$_anchor$ = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block$.m(target, anchor);
    			insert_dev(target, if_block$_anchor$, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type$ === (current_block_type$ = select_block_type$(ctx)) && if_block$) {
    				if_block$.p(ctx, dirty);
    			} else {
    				if_block$.d(1);
    				if_block$ = current_block_type$(ctx);

    				if (if_block$) {
    					if_block$.c();
    					if_block$.m(if_block$_anchor$.parentNode, if_block$_anchor$);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block$.d(detaching);
    			if (detaching) detach_dev(if_block$_anchor$);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_if_block$_1.name,
    		type: "if",
    		source: "(1084:8) {#if inspectorNode}",
    		ctx
    	});

    	return block$;
    }

    // (1145:12) {:else}
    function create_else_block$(ctx) {
    	let h3$;
    	let t1$;
    	let label0$;
    	let t2$;
    	let input$;
    	let t3$;
    	let label1$;
    	let t5$;
    	let textarea0$;
    	let t6$;
    	let label2$;
    	let t8$;
    	let label3$;
    	let t10$;
    	let button$;
    	let t12$;
    	let textarea1$;
    	let mounted;
    	let dispose;

    	const block$ = {
    		c: function create() {
    			h3$ = element("h3");
    			h3$.textContent = "Prompt";
    			t1$ = space();
    			label0$ = element("label");
    			t2$ = text("Name: ");
    			input$ = element("input");
    			t3$ = space();
    			label1$ = element("label");
    			label1$.textContent = "Command:";
    			t5$ = space();
    			textarea0$ = element("textarea");
    			t6$ = space();
    			label2$ = element("label");
    			label2$.textContent = "Define variables in the input node.";
    			t8$ = space();
    			label3$ = element("label");
    			label3$.textContent = "Output:";
    			t10$ = space();
    			button$ = element("button");
    			button$.textContent = "Copy";
    			t12$ = space();
    			textarea1$ = element("textarea");
    			attr_dev(h3$, "class", "svelte-uzk6d");
    			add_location(h3$, file$, 1145, 16, 43635);
    			input$.disabled = /*isRunning*/ ctx[3];
    			attr_dev(input$, "class", "svelte-uzk6d");
    			add_location(input$, file$, 1147, 27, 43701);
    			attr_dev(label0$, "class", "svelte-uzk6d");
    			add_location(label0$, file$, 1146, 16, 43667);
    			attr_dev(label1$, "class", "svelte-uzk6d");
    			add_location(label1$, file$, 1152, 16, 43873);
    			attr_dev(textarea0$, "rows", "10");
    			attr_dev(textarea0$, "class", "command-input svelte-uzk6d");
    			textarea0$.disabled = /*isRunning*/ ctx[3];
    			add_location(textarea0$, file$, 1153, 16, 43913);
    			attr_dev(label2$, "class", "hint svelte-uzk6d");
    			add_location(label2$, file$, 1159, 16, 44136);
    			attr_dev(label3$, "class", "svelte-uzk6d");
    			add_location(label3$, file$, 1160, 16, 44216);
    			attr_dev(button$, "class", "copy-button svelte-uzk6d");
    			add_location(button$, file$, 1161, 16, 44255);
    			attr_dev(textarea1$, "rows", "20");
    			textarea1$.readOnly = true;
    			attr_dev(textarea1$, "class", "svelte-uzk6d");
    			add_location(textarea1$, file$, 1162, 16, 44335);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3$, anchor);
    			insert_dev(target, t1$, anchor);
    			insert_dev(target, label0$, anchor);
    			append_dev(label0$, t2$);
    			append_dev(label0$, input$);
    			set_input_value(input$, /*inspectorNode*/ ctx[8].name);
    			insert_dev(target, t3$, anchor);
    			insert_dev(target, label1$, anchor);
    			insert_dev(target, t5$, anchor);
    			insert_dev(target, textarea0$, anchor);
    			set_input_value(textarea0$, /*inspectorNode*/ ctx[8].command);
    			insert_dev(target, t6$, anchor);
    			insert_dev(target, label2$, anchor);
    			insert_dev(target, t8$, anchor);
    			insert_dev(target, label3$, anchor);
    			insert_dev(target, t10$, anchor);
    			insert_dev(target, button$, anchor);
    			insert_dev(target, t12$, anchor);
    			insert_dev(target, textarea1$, anchor);
    			set_input_value(textarea1$, /*inspectorNode*/ ctx[8].outputText);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input$, "input", /*input$_input_handler$_1*/ ctx[30]),
    					listen_dev(textarea0$, "input", /*textarea0$_input_handler$*/ ctx[31]),
    					listen_dev(button$, "click", /*copyOutput*/ ctx[13], false, false, false, false),
    					listen_dev(textarea1$, "input", /*textarea1$_input_handler$*/ ctx[32])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(input$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256 && input$.value !== /*inspectorNode*/ ctx[8].name) {
    				set_input_value(input$, /*inspectorNode*/ ctx[8].name);
    			}

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(textarea0$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256) {
    				set_input_value(textarea0$, /*inspectorNode*/ ctx[8].command);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256) {
    				set_input_value(textarea1$, /*inspectorNode*/ ctx[8].outputText);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3$);
    			if (detaching) detach_dev(t1$);
    			if (detaching) detach_dev(label0$);
    			if (detaching) detach_dev(t3$);
    			if (detaching) detach_dev(label1$);
    			if (detaching) detach_dev(t5$);
    			if (detaching) detach_dev(textarea0$);
    			if (detaching) detach_dev(t6$);
    			if (detaching) detach_dev(label2$);
    			if (detaching) detach_dev(t8$);
    			if (detaching) detach_dev(label3$);
    			if (detaching) detach_dev(t10$);
    			if (detaching) detach_dev(button$);
    			if (detaching) detach_dev(t12$);
    			if (detaching) detach_dev(textarea1$);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_else_block$.name,
    		type: "else",
    		source: "(1145:12) {:else}",
    		ctx
    	});

    	return block$;
    }

    // (1135:54) 
    function create_if_block$_3(ctx) {
    	let h3$;
    	let t1$;
    	let label0$;
    	let t2$;
    	let t3$_value$ = /*inspectorNode*/ ctx[8].name + "";
    	let t3$;
    	let t4$;
    	let label1$;
    	let t6$;
    	let button$;
    	let t8$;
    	let textarea$;
    	let mounted;
    	let dispose;

    	const block$ = {
    		c: function create() {
    			h3$ = element("h3");
    			h3$.textContent = "Output";
    			t1$ = space();
    			label0$ = element("label");
    			t2$ = text("Name: ");
    			t3$ = text(t3$_value$);
    			t4$ = space();
    			label1$ = element("label");
    			label1$.textContent = "Output:";
    			t6$ = space();
    			button$ = element("button");
    			button$.textContent = "Copy";
    			t8$ = space();
    			textarea$ = element("textarea");
    			attr_dev(h3$, "class", "svelte-uzk6d");
    			add_location(h3$, file$, 1135, 16, 43234);
    			attr_dev(label0$, "class", "svelte-uzk6d");
    			add_location(label0$, file$, 1136, 16, 43266);
    			attr_dev(label1$, "class", "svelte-uzk6d");
    			add_location(label1$, file$, 1137, 16, 43324);
    			attr_dev(button$, "class", "copy-button svelte-uzk6d");
    			add_location(button$, file$, 1138, 16, 43363);
    			attr_dev(textarea$, "rows", "20");
    			textarea$.readOnly = true;
    			attr_dev(textarea$, "class", "svelte-uzk6d");
    			add_location(textarea$, file$, 1139, 16, 43443);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3$, anchor);
    			insert_dev(target, t1$, anchor);
    			insert_dev(target, label0$, anchor);
    			append_dev(label0$, t2$);
    			append_dev(label0$, t3$);
    			insert_dev(target, t4$, anchor);
    			insert_dev(target, label1$, anchor);
    			insert_dev(target, t6$, anchor);
    			insert_dev(target, button$, anchor);
    			insert_dev(target, t8$, anchor);
    			insert_dev(target, textarea$, anchor);
    			set_input_value(textarea$, /*inspectorNode*/ ctx[8].outputText);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button$, "click", /*copyOutput*/ ctx[13], false, false, false, false),
    					listen_dev(textarea$, "input", /*textarea$_input_handler$_2*/ ctx[29])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*inspectorNode*/ 256 && t3$_value$ !== (t3$_value$ = /*inspectorNode*/ ctx[8].name + "")) set_data_dev(t3$, t3$_value$);

    			if (dirty[0] & /*inspectorNode*/ 256) {
    				set_input_value(textarea$, /*inspectorNode*/ ctx[8].outputText);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3$);
    			if (detaching) detach_dev(t1$);
    			if (detaching) detach_dev(label0$);
    			if (detaching) detach_dev(t4$);
    			if (detaching) detach_dev(label1$);
    			if (detaching) detach_dev(t6$);
    			if (detaching) detach_dev(button$);
    			if (detaching) detach_dev(t8$);
    			if (detaching) detach_dev(textarea$);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_if_block$_3.name,
    		type: "if",
    		source: "(1135:54) ",
    		ctx
    	});

    	return block$;
    }

    // (1085:12) {#if inspectorNode.role === "input"}
    function create_if_block$_2(ctx) {
    	let h3$;
    	let t1$;
    	let label0$;
    	let t2$;
    	let t3$_value$ = /*inspectorNode*/ ctx[8].name + "";
    	let t3$;
    	let t4$;
    	let label1$;
    	let t6$;
    	let textarea$;
    	let t7$;
    	let label2$;
    	let t9$;
    	let each_blocks$ = [];
    	let each$_lookup$ = new Map$();
    	let t10$;
    	let button$;
    	let t11$;
    	let mounted;
    	let dispose;
    	let each_value$_1 = /*inspectorNode*/ ctx[8].envVars;
    	validate_each_argument(each_value$_1);
    	const get_key$ = ctx => /*idx*/ ctx[52];
    	validate_each_keys(ctx, each_value$_1, get_each_context$_1, get_key$);

    	for (let i = 0; i < each_value$_1.length; i += 1) {
    		let child_ctx = get_each_context$_1(ctx, each_value$_1, i);
    		let key = get_key$(child_ctx);
    		each$_lookup$.set(key, each_blocks$[i] = create_each_block$_1(key, child_ctx));
    	}

    	const block$ = {
    		c: function create() {
    			h3$ = element("h3");
    			h3$.textContent = "Input";
    			t1$ = space();
    			label0$ = element("label");
    			t2$ = text("Name: ");
    			t3$ = text(t3$_value$);
    			t4$ = space();
    			label1$ = element("label");
    			label1$.textContent = "Input:";
    			t6$ = space();
    			textarea$ = element("textarea");
    			t7$ = space();
    			label2$ = element("label");
    			label2$.textContent = "Environment Variables:";
    			t9$ = space();

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				each_blocks$[i].c();
    			}

    			t10$ = space();
    			button$ = element("button");
    			t11$ = text("Add Variable");
    			attr_dev(h3$, "class", "svelte-uzk6d");
    			add_location(h3$, file$, 1085, 16, 41061);
    			attr_dev(label0$, "class", "svelte-uzk6d");
    			add_location(label0$, file$, 1086, 16, 41092);
    			attr_dev(label1$, "class", "svelte-uzk6d");
    			add_location(label1$, file$, 1087, 16, 41150);
    			attr_dev(textarea$, "rows", "5");
    			textarea$.disabled = /*isRunning*/ ctx[3];
    			attr_dev(textarea$, "class", "svelte-uzk6d");
    			add_location(textarea$, file$, 1088, 16, 41188);
    			attr_dev(label2$, "class", "svelte-uzk6d");
    			add_location(label2$, file$, 1093, 16, 41370);
    			attr_dev(button$, "class", "copy-button svelte-uzk6d");
    			button$.disabled = /*isRunning*/ ctx[3];
    			add_location(button$, file$, 1123, 16, 42739);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3$, anchor);
    			insert_dev(target, t1$, anchor);
    			insert_dev(target, label0$, anchor);
    			append_dev(label0$, t2$);
    			append_dev(label0$, t3$);
    			insert_dev(target, t4$, anchor);
    			insert_dev(target, label1$, anchor);
    			insert_dev(target, t6$, anchor);
    			insert_dev(target, textarea$, anchor);
    			set_input_value(textarea$, /*inspectorNode*/ ctx[8].inputText);
    			insert_dev(target, t7$, anchor);
    			insert_dev(target, label2$, anchor);
    			insert_dev(target, t9$, anchor);

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				if (each_blocks$[i]) {
    					each_blocks$[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, t10$, anchor);
    			insert_dev(target, button$, anchor);
    			append_dev(button$, t11$);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea$, "input", /*textarea$_input_handler$*/ ctx[22]),
    					listen_dev(button$, "click", /*click_handler$_1*/ ctx[28], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*inspectorNode*/ 256 && t3$_value$ !== (t3$_value$ = /*inspectorNode*/ ctx[8].name + "")) set_data_dev(t3$, t3$_value$);

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(textarea$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256) {
    				set_input_value(textarea$, /*inspectorNode*/ ctx[8].inputText);
    			}

    			if (dirty[0] & /*isRunning, inspectorNode, scene*/ 266) {
    				each_value$_1 = /*inspectorNode*/ ctx[8].envVars;
    				validate_each_argument(each_value$_1);
    				validate_each_keys(ctx, each_value$_1, get_each_context$_1, get_key$);
    				each_blocks$ = update_keyed_each(each_blocks$, dirty, get_key$, 1, ctx, each_value$_1, each$_lookup$, t10$.parentNode, destroy_block, create_each_block$_1, t10$, get_each_context$_1);
    			}

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(button$, "disabled", /*isRunning*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3$);
    			if (detaching) detach_dev(t1$);
    			if (detaching) detach_dev(label0$);
    			if (detaching) detach_dev(t4$);
    			if (detaching) detach_dev(label1$);
    			if (detaching) detach_dev(t6$);
    			if (detaching) detach_dev(textarea$);
    			if (detaching) detach_dev(t7$);
    			if (detaching) detach_dev(label2$);
    			if (detaching) detach_dev(t9$);

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				each_blocks$[i].d(detaching);
    			}

    			if (detaching) detach_dev(t10$);
    			if (detaching) detach_dev(button$);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_if_block$_2.name,
    		type: "if",
    		source: "(1085:12) {#if inspectorNode.role === \\\"input\\\"}",
    		ctx
    	});

    	return block$;
    }

    // (1095:16) {#each inspectorNode.envVars as env, idx (idx)}
    function create_each_block$_1(key$_1, ctx) {
    	let div1$;
    	let div0$;
    	let input$;
    	let t0$;
    	let button$;
    	let t1$;
    	let t2$;
    	let textarea$;
    	let mounted;
    	let dispose;

    	function input$_input_handler$() {
    		/*input$_input_handler$*/ ctx[23].call(input$, /*each_value$_1*/ ctx[51], /*idx*/ ctx[52]);
    	}

    	function click_handler$() {
    		return /*click_handler$*/ ctx[25](/*idx*/ ctx[52]);
    	}

    	function textarea$_input_handler$_1() {
    		/*textarea$_input_handler$_1*/ ctx[26].call(textarea$, /*each_value$_1*/ ctx[51], /*idx*/ ctx[52]);
    	}

    	const block$ = {
    		key: key$_1,
    		first: null,
    		c: function create() {
    			div1$ = element("div");
    			div0$ = element("div");
    			input$ = element("input");
    			t0$ = space();
    			button$ = element("button");
    			t1$ = text("Remove");
    			t2$ = space();
    			textarea$ = element("textarea");
    			attr_dev(input$, "placeholder", "Key");
    			input$.disabled = /*isRunning*/ ctx[3];
    			attr_dev(input$, "class", "svelte-uzk6d");
    			add_location(input$, file$, 1097, 28, 41592);
    			attr_dev(button$, "class", "copy-button svelte-uzk6d");
    			button$.disabled = /*isRunning*/ ctx[3];
    			add_location(button$, file$, 1103, 28, 41884);
    			attr_dev(div0$, "class", "env-key-row svelte-uzk6d");
    			add_location(div0$, file$, 1096, 24, 41538);
    			attr_dev(textarea$, "placeholder", "Value");
    			attr_dev(textarea$, "rows", "3");
    			textarea$.disabled = /*isRunning*/ ctx[3];
    			attr_dev(textarea$, "class", "svelte-uzk6d");
    			add_location(textarea$, file$, 1114, 24, 42374);
    			attr_dev(div1$, "class", "env-row svelte-uzk6d");
    			add_location(div1$, file$, 1095, 20, 41492);
    			this.first = div1$;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1$, anchor);
    			append_dev(div1$, div0$);
    			append_dev(div0$, input$);
    			set_input_value(input$, /*env*/ ctx[50].key);
    			append_dev(div0$, t0$);
    			append_dev(div0$, button$);
    			append_dev(button$, t1$);
    			append_dev(div1$, t2$);
    			append_dev(div1$, textarea$);
    			set_input_value(textarea$, /*env*/ ctx[50].value);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input$, "input", input$_input_handler$),
    					listen_dev(input$, "input", /*input_handler$*/ ctx[24], false, false, false, false),
    					listen_dev(button$, "click", click_handler$, false, false, false, false),
    					listen_dev(textarea$, "input", textarea$_input_handler$_1),
    					listen_dev(textarea$, "input", /*input_handler$_1*/ ctx[27], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(input$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256 && input$.value !== /*env*/ ctx[50].key) {
    				set_input_value(input$, /*env*/ ctx[50].key);
    			}

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(button$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*isRunning*/ 8) {
    				prop_dev(textarea$, "disabled", /*isRunning*/ ctx[3]);
    			}

    			if (dirty[0] & /*inspectorNode*/ 256) {
    				set_input_value(textarea$, /*env*/ ctx[50].value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1$);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_each_block$_1.name,
    		type: "each",
    		source: "(1095:16) {#each inspectorNode.envVars as env, idx (idx)}",
    		ctx
    	});

    	return block$;
    }

    // (1177:12) {#if label.name}
    function create_if_block$(ctx) {
    	let div$;
    	let t0$_value$ = /*label*/ ctx[47].name + "";
    	let t0$;
    	let t1$;

    	const block$ = {
    		c: function create() {
    			div$ = element("div");
    			t0$ = text(t0$_value$);
    			t1$ = space();
    			attr_dev(div$, "class", "node-label svelte-uzk6d");
    			set_style(div$, "left", /*label*/ ctx[47].x + "px");
    			set_style(div$, "top", /*label*/ ctx[47].y + "px");
    			add_location(div$, file$, 1177, 16, 44824);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div$, anchor);
    			append_dev(div$, t0$);
    			append_dev(div$, t1$);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*labels*/ 32 && t0$_value$ !== (t0$_value$ = /*label*/ ctx[47].name + "")) set_data_dev(t0$, t0$_value$);

    			if (dirty[0] & /*labels*/ 32) {
    				set_style(div$, "left", /*label*/ ctx[47].x + "px");
    			}

    			if (dirty[0] & /*labels*/ 32) {
    				set_style(div$, "top", /*label*/ ctx[47].y + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div$);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_if_block$.name,
    		type: "if",
    		source: "(1177:12) {#if label.name}",
    		ctx
    	});

    	return block$;
    }

    // (1176:8) {#each labels as label, i (i)}
    function create_each_block$(key$_1, ctx) {
    	let first$;
    	let if_block$_anchor$;
    	let if_block$ = /*label*/ ctx[47].name && create_if_block$(ctx);

    	const block$ = {
    		key: key$_1,
    		first: null,
    		c: function create() {
    			first$ = empty();
    			if (if_block$) if_block$.c();
    			if_block$_anchor$ = empty();
    			this.first = first$;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first$, anchor);
    			if (if_block$) if_block$.m(target, anchor);
    			insert_dev(target, if_block$_anchor$, anchor);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*label*/ ctx[47].name) {
    				if (if_block$) {
    					if_block$.p(ctx, dirty);
    				} else {
    					if_block$ = create_if_block$(ctx);
    					if_block$.c();
    					if_block$.m(if_block$_anchor$.parentNode, if_block$_anchor$);
    				}
    			} else if (if_block$) {
    				if_block$.d(1);
    				if_block$ = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first$);
    			if (if_block$) if_block$.d(detaching);
    			if (detaching) detach_dev(if_block$_anchor$);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_each_block$.name,
    		type: "each",
    		source: "(1176:8) {#each labels as label, i (i)}",
    		ctx
    	});

    	return block$;
    }

    function create_fragment(ctx) {
    	let div5$;
    	let h1$;
    	let t0$;
    	let t1$;
    	let div0$;
    	let t2$;
    	let div1$;
    	let t3$;
    	let div2$;
    	let canvas$;
    	let t4$;
    	let each_blocks$ = [];
    	let each$_lookup$ = new Map$();
    	let t5$;
    	let div4$;
    	let button0$;
    	let svg0$;
    	let path0$;
    	let t6$;
    	let button0$_disabled_value$;
    	let t7$;
    	let button1$;
    	let svg1$;
    	let path1$;
    	let t8$;
    	let button1$_disabled_value$;
    	let t9$;
    	let div3$;
    	let t10$;
    	let button2$;
    	let t12$;
    	let button3$;
    	let t14$;
    	let button4$;
    	let mounted;
    	let dispose;
    	let if_block$ = /*inspectorNode*/ ctx[8] && create_if_block$_1(ctx);
    	let each_value$ = /*labels*/ ctx[5];
    	validate_each_argument(each_value$);
    	const get_key$ = ctx => /*i*/ ctx[49];
    	validate_each_keys(ctx, each_value$, get_each_context$, get_key$);

    	for (let i = 0; i < each_value$.length; i += 1) {
    		let child_ctx = get_each_context$(ctx, each_value$, i);
    		let key = get_key$(child_ctx);
    		each$_lookup$.set(key, each_blocks$[i] = create_each_block$(key, child_ctx));
    	}

    	const block$ = {
    		c: function create() {
    			div5$ = element("div");
    			h1$ = element("h1");
    			t0$ = text(/*sceneName*/ ctx[2]);
    			t1$ = space();
    			div0$ = element("div");
    			if (if_block$) if_block$.c();
    			t2$ = space();
    			div1$ = element("div");
    			t3$ = space();
    			div2$ = element("div");
    			canvas$ = element("canvas");
    			t4$ = space();

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				each_blocks$[i].c();
    			}

    			t5$ = space();
    			div4$ = element("div");
    			button0$ = element("button");
    			svg0$ = svg_element("svg");
    			path0$ = svg_element("path");
    			t6$ = text("\n            Play");
    			t7$ = space();
    			button1$ = element("button");
    			svg1$ = svg_element("svg");
    			path1$ = svg_element("path");
    			t8$ = text("\n            Stop");
    			t9$ = space();
    			div3$ = element("div");
    			t10$ = space();
    			button2$ = element("button");
    			button2$.textContent = "New";
    			t12$ = space();
    			button3$ = element("button");
    			button3$.textContent = "Import";
    			t14$ = space();
    			button4$ = element("button");
    			button4$.textContent = "Export";
    			attr_dev(h1$, "class", "scene-title svelte-uzk6d");
    			attr_dev(h1$, "contenteditable", "true");
    			add_location(h1$, file$, 1073, 4, 40692);
    			attr_dev(div0$, "class", "info-panel svelte-uzk6d");
    			set_style(div0$, "width", /*panelWidth*/ ctx[6] + "px");
    			add_location(div0$, file$, 1082, 4, 40912);
    			attr_dev(div1$, "class", "resizer svelte-uzk6d");
    			add_location(div1$, file$, 1171, 4, 44589);
    			attr_dev(canvas$, "class", "svelte-uzk6d");
    			add_location(canvas$, file$, 1174, 8, 44703);
    			attr_dev(div2$, "class", "canvas-container svelte-uzk6d");
    			add_location(div2$, file$, 1173, 4, 44664);
    			attr_dev(path0$, "d", "M8 5v14l11-7z");
    			add_location(path0$, file$, 1196, 16, 45363);
    			attr_dev(svg0$, "width", "16");
    			attr_dev(svg0$, "height", "16");
    			attr_dev(svg0$, "viewBox", "0 0 24 24");
    			attr_dev(svg0$, "fill", "currentColor");
    			attr_dev(svg0$, "aria-hidden", "true");
    			add_location(svg0$, file$, 1189, 12, 45166);
    			button0$.disabled = button0$_disabled_value$ = /*isRunning*/ ctx[3] || !/*hasPath*/ ctx[7];
    			attr_dev(button0$, "class", "svelte-uzk6d");
    			add_location(button0$, file$, 1188, 8, 45088);
    			attr_dev(path1$, "d", "M6 6h12v12H6z");
    			add_location(path1$, file$, 1208, 16, 45716);
    			attr_dev(svg1$, "width", "16");
    			attr_dev(svg1$, "height", "16");
    			attr_dev(svg1$, "viewBox", "0 0 24 24");
    			attr_dev(svg1$, "fill", "currentColor");
    			attr_dev(svg1$, "aria-hidden", "true");
    			add_location(svg1$, file$, 1201, 12, 45519);
    			button1$.disabled = button1$_disabled_value$ = !/*isRunning*/ ctx[3];
    			attr_dev(button1$, "class", "svelte-uzk6d");
    			add_location(button1$, file$, 1200, 8, 45452);
    			attr_dev(div3$, "class", "vertical-separator svelte-uzk6d");
    			add_location(div3$, file$, 1212, 8, 45805);
    			attr_dev(button2$, "class", "svelte-uzk6d");
    			add_location(button2$, file$, 1213, 8, 45852);
    			attr_dev(button3$, "class", "svelte-uzk6d");
    			add_location(button3$, file$, 1214, 8, 45901);
    			attr_dev(button4$, "class", "svelte-uzk6d");
    			add_location(button4$, file$, 1215, 8, 45956);
    			attr_dev(div4$, "class", "controls svelte-uzk6d");
    			add_location(div4$, file$, 1187, 4, 45057);
    			attr_dev(div5$, "class", "app-wrap svelte-uzk6d");
    			add_location(div5$, file$, 1072, 0, 40665);
    		},
    		l: function claim(nodes) {
    			throw new Error$("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5$, anchor);
    			append_dev(div5$, h1$);
    			append_dev(h1$, t0$);
    			/*h1$_binding$*/ ctx[21](h1$);
    			append_dev(div5$, t1$);
    			append_dev(div5$, div0$);
    			if (if_block$) if_block$.m(div0$, null);
    			append_dev(div5$, t2$);
    			append_dev(div5$, div1$);
    			append_dev(div5$, t3$);
    			append_dev(div5$, div2$);
    			append_dev(div2$, canvas$);
    			/*canvas$_binding$*/ ctx[33](canvas$);
    			append_dev(div2$, t4$);

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				if (each_blocks$[i]) {
    					each_blocks$[i].m(div2$, null);
    				}
    			}

    			append_dev(div5$, t5$);
    			append_dev(div5$, div4$);
    			append_dev(div4$, button0$);
    			append_dev(button0$, svg0$);
    			append_dev(svg0$, path0$);
    			append_dev(button0$, t6$);
    			append_dev(div4$, t7$);
    			append_dev(div4$, button1$);
    			append_dev(button1$, svg1$);
    			append_dev(svg1$, path1$);
    			append_dev(button1$, t8$);
    			append_dev(div4$, t9$);
    			append_dev(div4$, div3$);
    			append_dev(div4$, t10$);
    			append_dev(div4$, button2$);
    			append_dev(div4$, t12$);
    			append_dev(div4$, button3$);
    			append_dev(div4$, t14$);
    			append_dev(div4$, button4$);

    			if (!mounted) {
    				dispose = [
    					listen_dev(h1$, "blur", /*handleSceneTitleBlur*/ ctx[16], false, false, false, false),
    					listen_dev(h1$, "keydown", handleSceneTitleKeydown, false, false, false, false),
    					listen_dev(div1$, "mousedown", /*handlePanelResizeMouseDown*/ ctx[9], false, false, false, false),
    					listen_dev(button0$, "click", /*playPipeline*/ ctx[10], false, false, false, false),
    					listen_dev(button1$, "click", /*stopPipeline*/ ctx[11], false, false, false, false),
    					listen_dev(button2$, "click", /*newScene*/ ctx[12], false, false, false, false),
    					listen_dev(button3$, "click", /*importScene*/ ctx[14], false, false, false, false),
    					listen_dev(button4$, "click", /*exportScene*/ ctx[15], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*sceneName*/ 4) set_data_contenteditable_dev(t0$, /*sceneName*/ ctx[2]);

    			if (/*inspectorNode*/ ctx[8]) {
    				if (if_block$) {
    					if_block$.p(ctx, dirty);
    				} else {
    					if_block$ = create_if_block$_1(ctx);
    					if_block$.c();
    					if_block$.m(div0$, null);
    				}
    			} else if (if_block$) {
    				if_block$.d(1);
    				if_block$ = null;
    			}

    			if (dirty[0] & /*panelWidth*/ 64) {
    				set_style(div0$, "width", /*panelWidth*/ ctx[6] + "px");
    			}

    			if (dirty[0] & /*labels*/ 32) {
    				each_value$ = /*labels*/ ctx[5];
    				validate_each_argument(each_value$);
    				validate_each_keys(ctx, each_value$, get_each_context$, get_key$);
    				each_blocks$ = update_keyed_each(each_blocks$, dirty, get_key$, 1, ctx, each_value$, each$_lookup$, div2$, destroy_block, create_each_block$, null, get_each_context$);
    			}

    			if (dirty[0] & /*isRunning, hasPath*/ 136 && button0$_disabled_value$ !== (button0$_disabled_value$ = /*isRunning*/ ctx[3] || !/*hasPath*/ ctx[7])) {
    				prop_dev(button0$, "disabled", button0$_disabled_value$);
    			}

    			if (dirty[0] & /*isRunning*/ 8 && button1$_disabled_value$ !== (button1$_disabled_value$ = !/*isRunning*/ ctx[3])) {
    				prop_dev(button1$, "disabled", button1$_disabled_value$);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5$);
    			/*h1$_binding$*/ ctx[21](null);
    			if (if_block$) if_block$.d();
    			/*canvas$_binding$*/ ctx[33](null);

    			for (let i = 0; i < each_blocks$.length; i += 1) {
    				each_blocks$[i].d();
    			}

    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block$,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block$;
    }

    function handleSceneTitleKeydown(e) {
    	if (e.key === "Enter" || e.key === "Escape") {
    		e.preventDefault();
    		e.target.blur();
    	}
    }

    function instance$($$self, $$props, $$invalidate) {
    	let inspectorNode;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let sceneTitleEl;

    	onMount(() => {
    		const handleWindowMousedown = e => {
    			if (sceneTitleEl && !sceneTitleEl.contains(e.target)) {
    				sceneTitleEl.blur();
    			}
    		};

    		window.addEventListener("mousedown", handleWindowMousedown);

    		return () => {
    			window.removeEventListener("mousedown", handleWindowMousedown);
    		};
    	});

    	let canvas;

    	// Define consistent node colors: same for input/output, same for inner nodes
    	// Node color palette for high contrast against dark background
    	// Input/output nodes: amber (#FFB74D)
    	const ioColor = [1, 0.718, 0.302, 1];

    	// Prompt nodes: cyan (#4DD0E1)
    	const defaultNodeColor = [0.302, 0.816, 0.882, 1];

    	// Selected nodes and edges: pink (#E91E63)
    	const selectedColor = [0.91, 0.12, 0.39, 1];

    	// Highlight during pipeline execution: yellow (#FFEB3B)
    	const highlightColor = [1, 0.92, 0.23, 1];

    	let scene;
    	let sceneName;

    	if (typeof window !== "undefined") {
    		const saved = window.localStorage.getItem("scene");

    		if (saved) {
    			try {
    				const parsed = JSON.parse(saved);

    				if (parsed && typeof parsed === "object" && parsed.hasOwnProperty("scene")) {
    					sceneName = parsed.name || "Untitled Flow";
    					const sceneData = parsed.scene || [];
    					const circles = sceneData.filter(s => s.type === "circle");

    					circles.forEach(s => {
    						if (s.role === "input" && s.envVars == null) {
    							s.envVars = [];
    						}
    					});

    					const edgesRaw = sceneData.filter(s => s.type === "edge");
    					const newScene = [...circles];

    					edgesRaw.forEach(e => {
    						const fromNode = newScene.find(s => s.type === "circle" && s.name === e.from.name);
    						const toNode = newScene.find(s => s.type === "circle" && s.name === e.to.name);

    						if (fromNode && toNode) {
    							newScene.push({
    								type: "edge",
    								from: fromNode,
    								to: toNode,
    								color: e.color,
    								selected: e.selected,
    								highlight: e.highlight || false
    							});
    						}
    					});

    					scene = newScene;
    				} else {
    					// Old format or corrupted, initialize a new scene
    					scene = [];

    					sceneName = "Untitled Flow";
    				}
    			} catch(err) {
    				console.error("Failed to load scene from localStorage:", err);
    				scene = [];
    				sceneName = "Untitled Flow";
    			}
    		} else {
    			// No saved data, initialize a new scene
    			scene = [];

    			sceneName = "Untitled Flow";
    		}
    	} else {
    		// SSR
    		scene = [];

    		sceneName = "Untitled Flow";
    	}

    	// View transform for positioning and zoom
    	let viewScale = 1;

    	let viewOffset = [0, 0];

    	// Screen-space labels below each node
    	let labels = [];

    	// Resizable info panel width
    	let panelWidth = 350;

    	let isResizing = false;
    	let panelResizeStartX = 0;
    	let panelResizeStartWidth = 0;

    	// Resize handlers for the info panel
    	function handlePanelResizeMouseDown(e) {
    		isResizing = true;
    		panelResizeStartX = e.clientX;
    		panelResizeStartWidth = panelWidth;
    		window.addEventListener("mousemove", handlePanelResizeMouseMove);
    		window.addEventListener("mouseup", handlePanelResizeMouseUp);
    		e.preventDefault();
    	}

    	function handlePanelResizeMouseMove(e) {
    		if (!isResizing) return;
    		const delta = panelResizeStartX - e.clientX;
    		const minWidth = 200;
    		const maxWidth = window.innerWidth - 100;
    		$$invalidate(6, panelWidth = Math.max(minWidth, Math.min(maxWidth, panelResizeStartWidth + delta)));
    	}

    	function handlePanelResizeMouseUp() {
    		if (isResizing) {
    			isResizing = false;
    			window.removeEventListener("mousemove", handlePanelResizeMouseMove);
    			window.removeEventListener("mouseup", handlePanelResizeMouseUp);
    		}
    	}

    	function addCircle(x, y) {
    		const prevSelected = scene.find(s => s.type === "circle" && s.selected);

    		const newNode = {
    			type: "circle",
    			role: "default",
    			name: `Prompt ${scene.filter(s => s.type === "circle").length - 1}`,
    			command: "echo 'hello'",
    			center: [x, y],
    			radius: 0.1,
    			color: defaultNodeColor,
    			selected: true,
    			highlight: false,
    			outputText: ""
    		};

    		if (prevSelected) {
    			prevSelected.selected = false;
    		}

    		scene.push(newNode);

    		if (prevSelected) {
    			scene.push({
    				type: "edge",
    				from: prevSelected,
    				to: newNode,
    				color: [1, 1, 1, 1],
    				selected: false
    			});
    		}

    		$$invalidate(1, scene = [...scene]);
    	}

    	onMount(() => {
    		// Set canvas size and pixel ratio for crisp rendering
    		const resizeCanvas = () => {
    			// Size canvas to its display container (excluding info panel)
    			const width = canvas.clientWidth * window.devicePixelRatio;

    			const height = canvas.clientHeight * window.devicePixelRatio;
    			$$invalidate(0, canvas.width = width, canvas);
    			$$invalidate(0, canvas.height = height, canvas);
    		};

    		resizeCanvas();
    		window.addEventListener("resize", resizeCanvas);

    		const regl$1 = regl({
    			canvas,
    			pixelRatio: window.devicePixelRatio
    		});

    		// Pan and zoom state uses component-level viewScale & viewOffset
    		// Smooth zoom target values
    		let viewScaleTarget = viewScale;

    		let viewOffsetTarget = [...viewOffset];

    		// Zoom smoothing and sensitivity
    		const SMOOTHING = 0.2; // increased for snappier transitions

    		const ZOOM_BASE = 1.005; // zoom sensitivity base per wheel delta
    		let isPanning = false;
    		let panStart = [0, 0];
    		let offsetStart = [0, 0];

    		// Quad covering unit circle area for fragment discarding
    		const quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];

    		const quadBuffer = regl$1.buffer(quadPositions);

    		const drawCircle = regl$1({
    			frag: `
            precision mediump float;
            varying vec4 fragColor;
            varying vec2 vPosition;
            void main() {
                if (dot(vPosition, vPosition) > 1.0) discard;
                gl_FragColor = fragColor;
            }`,
    			vert: `
            precision mediump float;
            attribute vec2 position;
            uniform vec2 center;
            uniform float radius;
            uniform float aspect;
            uniform vec4 color;
            uniform float viewScale;
            uniform vec2 viewOffset;
            varying vec4 fragColor;
            varying vec2 vPosition;
            void main() {
                vPosition = position;
                vec2 pos = center + position * vec2(radius * aspect, radius);
                // Apply view transform
                vec2 transformed = pos * viewScale + viewOffset;
                gl_Position = vec4(transformed, 0, 1);
                fragColor = color;
            }`,
    			attributes: { position: quadBuffer },
    			uniforms: {
    				aspect: ctx => ctx.viewportHeight / ctx.viewportWidth,
    				center: regl$1.prop("center"),
    				radius: regl$1.prop("radius"),
    				color: regl$1.prop("color"),
    				viewScale: () => viewScale,
    				viewOffset: () => viewOffset
    			},
    			count: 6,
    			primitive: "triangles"
    		});

    		// Edge drawing commands
    		const drawLine = regl$1({
    			frag: `
            precision mediump float;
            uniform vec4 color;
            void main() {
                gl_FragColor = color;
            }`,
    			vert: `
            precision mediump float;
            attribute vec2 position;
            uniform float viewScale;
            uniform vec2 viewOffset;
            void main() {
                vec2 pos = position * viewScale + viewOffset;
                gl_Position = vec4(pos, 0, 1);
            }`,
    			attributes: { position: regl$1.prop("positions") },
    			uniforms: {
    				color: regl$1.prop("color"),
    				viewScale: () => viewScale,
    				viewOffset: () => viewOffset
    			},
    			// number of vertices for each line segment (2 points)
    			count: 2,
    			primitive: "lines"
    		});

    		const drawTriangle = regl$1({
    			frag: `
            precision mediump float;
            uniform vec4 color;
            void main() {
                gl_FragColor = color;
            }`,
    			vert: `
            precision mediump float;
            attribute vec2 position;
            uniform float viewScale;
            uniform vec2 viewOffset;
            void main() {
                vec2 pos = position * viewScale + viewOffset;
                gl_Position = vec4(pos, 0, 1);
            }`,
    			attributes: { position: regl$1.prop("positions") },
    			uniforms: {
    				color: regl$1.prop("color"),
    				viewScale: () => viewScale,
    				viewOffset: () => viewOffset
    			},
    			// number of vertices for each triangle (3 points)
    			count: 3,
    			primitive: "triangles"
    		});

    		// Drag and drop support for circles
    		let dragging = null;

    		let dragOffset = [0, 0];

    		canvas.addEventListener("mousedown", e => {
    			if (e.button !== 0) return;

    			// Clear any pipeline highlight when manually selecting
    			scene.forEach(s => s.highlight = false);

    			// Trigger reactive update to clear highlight in UI
    			$$invalidate(1, scene = [...scene]);

    			const rect = canvas.getBoundingClientRect();

    			// Pointer in NDC
    			const ndcX = (e.clientX - rect.left) / rect.width * 2 - 1;

    			const ndcY = 1 - (e.clientY - rect.top) / rect.height * 2;

    			// Convert to world coordinates
    			const worldX = (ndcX - viewOffset[0]) / viewScale;

    			const worldY = (ndcY - viewOffset[1]) / viewScale;
    			let hitShape = null;
    			let hitDx = 0, hitDy = 0;

    			for (let i = scene.length - 1; i >= 0; i--) {
    				const shape = scene[i];
    				if (shape.type !== "circle") continue;
    				const dx = worldX - shape.center[0];
    				const dy = worldY - shape.center[1];

    				if (Math.sqrt(dx * dx + dy * dy) <= shape.radius) {
    					hitShape = shape;
    					hitDx = dx;
    					hitDy = dy;
    					break;
    				}
    			}

    			if (hitShape) {
    				// Clear any edge selections when selecting a circle
    				scene.forEach(s => {
    					if (s.type === "edge") s.selected = false;
    				});

    				const prevSelected = scene.find(s => s.type === "circle" && s.selected);

    				if (prevSelected && prevSelected !== hitShape && prevSelected.role !== "output") {
    					// Remove any existing edge between these two circles
    					for (let i = scene.length - 1; i >= 0; i--) {
    						const s = scene[i];

    						if (s.type === "edge" && (s.from === prevSelected && s.to === hitShape || s.from === hitShape && s.to === prevSelected)) {
    							scene.splice(i, 1);
    						}
    					}

    					// Connect the previously selected circle to the clicked circle
    					scene.push({
    						type: "edge",
    						from: prevSelected,
    						to: hitShape,
    						color: [1, 1, 1, 1],
    						selected: false
    					});

    					// Unselect all circles
    					scene.forEach(s => {
    						if (s.type === "circle") s.selected = false;
    					});

    					// Cancel any dragging state
    					dragging = null;

    					// Trigger reactivity for scene changes
    					$$invalidate(1, scene = [...scene]);

    					return;
    				}

    				// No connection: begin dragging/selecting the clicked circle
    				dragging = hitShape;

    				dragOffset = [hitDx, hitDy];

    				// Select only this circle
    				scene.forEach(s => {
    					if (s.type === "circle") s.selected = false;
    				});

    				dragging.selected = true;

    				// Trigger reactivity for selection change
    				$$invalidate(1, scene = [...scene]);
    			} else {
    				// Try selecting an edge if clicked near it
    				const EDGE_TOLERANCE = 0.03;

    				let hitEdge = null;

    				for (let i = scene.length - 1; i >= 0; i--) {
    					const s = scene[i];
    					if (s.type !== "edge") continue;
    					const x1 = s.from.center[0], y1 = s.from.center[1];
    					const x2 = s.to.center[0], y2 = s.to.center[1];
    					const dx = x2 - x1, dy = y2 - y1;
    					const len2 = dx * dx + dy * dy;
    					let t = ((worldX - x1) * dx + (worldY - y1) * dy) / len2;
    					t = Math.max(0, Math.min(1, t));
    					const projX = x1 + t * dx, projY = y1 + t * dy;
    					const dist2 = (worldX - projX) * (worldX - projX) + (worldY - projY) * (worldY - projY);

    					if (dist2 <= EDGE_TOLERANCE * EDGE_TOLERANCE) {
    						hitEdge = s;
    						break;
    					}
    				}

    				if (hitEdge) {
    					// Deselect all circles and edges
    					scene.forEach(s => {
    						if (s.type === "circle" || s.type === "edge") s.selected = false;
    					});

    					hitEdge.selected = true;

    					// Cancel dragging or panning
    					dragging = null;

    					isPanning = false;

    					// Trigger reactivity for edge selection
    					$$invalidate(1, scene = [...scene]);

    					return;
    				}

    				// No shape hit: deselect everything and start panning
    				scene.forEach(s => {
    					if (s.type === "circle" || s.type === "edge") s.selected = false;
    				});

    				// Trigger reactivity for deselection
    				$$invalidate(1, scene = [...scene]);

    				isPanning = true;
    				panStart = [e.clientX, e.clientY];
    				viewOffsetTarget = [...viewOffset];
    				offsetStart = [...viewOffsetTarget];
    			}
    		});

    		window.addEventListener("mousemove", e => {
    			if (dragging) {
    				const rect = canvas.getBoundingClientRect();

    				// Pointer in NDC
    				const ndcX = (e.clientX - rect.left) / rect.width * 2 - 1;

    				const ndcY = 1 - (e.clientY - rect.top) / rect.height * 2;

    				// Convert to world coordinates
    				const x = (ndcX - viewOffset[0]) / viewScale;

    				const y = (ndcY - viewOffset[1]) / viewScale;
    				dragging.center[0] = x - dragOffset[0];
    				dragging.center[1] = y - dragOffset[1];
    			}
    		});

    		window.addEventListener("mouseup", () => {
    			dragging = null;
    		});

    		// Pan and zoom event handlers
    		canvas.addEventListener("contextmenu", e => e.preventDefault());

    		canvas.addEventListener("wheel", e => {
    			e.preventDefault();
    			const rect = canvas.getBoundingClientRect();
    			const px = (e.clientX - rect.left) / rect.width * 2 - 1;
    			const py = 1 - (e.clientY - rect.top) / rect.height * 2;
    			const factor = Math.pow(ZOOM_BASE, -e.deltaY);
    			viewScaleTarget *= factor;
    			viewOffsetTarget[0] = px - (px - viewOffsetTarget[0]) * factor;
    			viewOffsetTarget[1] = py - (py - viewOffsetTarget[1]) * factor;
    		});

    		canvas.addEventListener("mousedown", e => {
    			if (e.button === 2) {
    				isPanning = true;
    				panStart = [e.clientX, e.clientY];
    				viewOffsetTarget = [...viewOffset];
    				offsetStart = [...viewOffsetTarget];
    			}
    		});

    		window.addEventListener("mousemove", e => {
    			if (isPanning) {
    				const rect = canvas.getBoundingClientRect();
    				const dx = e.clientX - panStart[0];
    				const dy = e.clientY - panStart[1];
    				const ndcX = dx / rect.width * 2;
    				const ndcY = -dy / rect.height * 2;
    				viewOffsetTarget[0] = offsetStart[0] + ndcX;
    				viewOffsetTarget[1] = offsetStart[1] + ndcY;
    				$$invalidate(18, viewOffset[0] = viewOffsetTarget[0], viewOffset);
    				$$invalidate(18, viewOffset[1] = viewOffsetTarget[1], viewOffset);
    			}
    		});

    		window.addEventListener("mouseup", e => {
    			// End panning on right or left mouse release
    			if (e.button === 2 || e.button === 0) {
    				isPanning = false;
    			}
    		});

    		canvas.addEventListener("dblclick", e => {
    			const rect = canvas.getBoundingClientRect();

    			// Pointer in NDC
    			const ndcX = (e.clientX - rect.left) / rect.width * 2 - 1;

    			const ndcY = 1 - (e.clientY - rect.top) / rect.height * 2;

    			// Convert to world coordinates
    			const worldX = (ndcX - viewOffset[0]) / viewScale;

    			const worldY = (ndcY - viewOffset[1]) / viewScale;
    			addCircle(worldX, worldY);
    		});

    		// Delete selected circles or edges on Backspace when not editing text
    		window.addEventListener("keydown", e => {
    			if (e.key !== "Backspace") {
    				return;
    			}

    			const target = e.target;

    			// Ignore backspace if focus is on an input or textarea
    			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    				return;
    			}

    			// Prevent default browser back navigation or deletion behavior
    			e.preventDefault();

    			// Delete selected circle if any
    			const circleIdx = scene.findIndex(s => s.type === "circle" && s.selected);

    			if (circleIdx !== -1) {
    				const circle = scene[circleIdx];

    				// Prevent deletion of input/output nodes
    				if (circle.role === "input" || circle.role === "output") {
    					return;
    				}

    				// Remove the circle and any connected edges
    				scene.splice(circleIdx, 1);

    				for (let i = scene.length - 1; i >= 0; i--) {
    					const s = scene[i];

    					if (s.type === "edge" && (s.from === circle || s.to === circle)) {
    						scene.splice(i, 1);
    					}
    				}

    				// Trigger reactivity
    				$$invalidate(1, scene = [...scene]);

    				return;
    			}

    			// Delete selected edge if no circle deletion
    			const edgeIdx = scene.findIndex(s => s.type === "edge" && s.selected);

    			if (edgeIdx !== -1) {
    				scene.splice(edgeIdx, 1);

    				// Trigger reactivity
    				$$invalidate(1, scene = [...scene]);
    			}
    		});

    		regl$1.frame(() => {
    			$$invalidate(17, viewScale += (viewScaleTarget - viewScale) * SMOOTHING);
    			$$invalidate(18, viewOffset[0] += (viewOffsetTarget[0] - viewOffset[0]) * SMOOTHING, viewOffset);
    			$$invalidate(18, viewOffset[1] += (viewOffsetTarget[1] - viewOffset[1]) * SMOOTHING, viewOffset);

    			// Warm dark grey background
    			regl$1.clear({ color: [0.18, 0.18, 0.18, 1], depth: 1 });

    			// Draw edges with arrow heads
    			scene.forEach(shape => {
    				if (shape.type === "edge") {
    					const p1 = shape.from.center;
    					const p2 = shape.to.center;

    					// Highlight if selected
    					const edgeColor = shape.selected
    					? selectedColor
    					: shape.highlight ? highlightColor : shape.color;

    					// Compute direction and clip line to circle perimeters
    					const dx = p2[0] - p1[0];

    					const dy = p2[1] - p1[1];
    					const len = Math.sqrt(dx * dx + dy * dy);

    					if (len > 0) {
    						const ux = dx / len;
    						const uy = dy / len;
    						const aspect = canvas.clientHeight / canvas.clientWidth;

    						// Source circle boundary
    						const r1 = shape.from.radius;

    						const rX1 = r1 * aspect;
    						const rY1 = r1;
    						const t0 = rX1 * rY1 / Math.sqrt(ux * ux * rY1 * rY1 + uy * uy * rX1 * rX1);
    						const start = [p1[0] + ux * t0, p1[1] + uy * t0];

    						// Target circle boundary
    						const r2 = shape.to.radius;

    						const rX2 = r2 * aspect;
    						const rY2 = r2;
    						const t1 = rX2 * rY2 / Math.sqrt(ux * ux * rY2 * rY2 + uy * uy * rX2 * rX2);
    						const end = [p2[0] - ux * t1, p2[1] - uy * t1];

    						// Draw clipped line
    						drawLine({
    							positions: [start, end],
    							color: edgeColor
    						});

    						// Draw arrow head at the perimeter
    						const arrowLen = r2 * 0.4;

    						const arrowWid = r2 * 0.15;
    						const baseX = end[0] - ux * arrowLen;
    						const baseY = end[1] - uy * arrowLen;
    						const px = -uy;
    						const py = ux;
    						const left = [baseX + px * arrowWid, baseY + py * arrowWid];
    						const right = [baseX - px * arrowWid, baseY - py * arrowWid];

    						drawTriangle({
    							positions: [[end[0], end[1]], left, right],
    							color: edgeColor
    						});
    					}
    				}
    			});

    			// Draw circles on top of edges
    			scene.forEach(shape => {
    				if (shape.type === "circle") {
    					if (shape.selected) {
    						// Selected: draw an outline ring then fill
    						const outlineFactor = 1.2;

    						drawCircle({
    							center: shape.center,
    							radius: shape.radius * outlineFactor,
    							color: selectedColor
    						});

    						drawCircle({
    							center: shape.center,
    							radius: shape.radius,
    							color: shape.color
    						});
    					} else if (shape.highlight) {
    						// Highlighted during play: fill with highlight color
    						drawCircle({
    							center: shape.center,
    							radius: shape.radius,
    							color: highlightColor
    						});
    					} else {
    						// Normal node
    						drawCircle({
    							center: shape.center,
    							radius: shape.radius,
    							color: shape.color
    						});
    					}
    				}
    			});
    		});
    	});

    	let selectedShape = scene.find(s => s.type === "circle" && (s.highlight || s.selected));
    	let isRunning = false;
    	let abort = false;
    	let currentNode = null;

    	function getPipelineNodes() {
    		const inputNode = scene.find(s => s.role === "input");
    		const outputNode = scene.find(s => s.role === "output");
    		if (!inputNode || !outputNode) return [];
    		const nodes = scene.filter(s => s.type === "circle");
    		const edges = scene.filter(s => s.type === "edge");
    		const adj = new Map(nodes.map(n => [n, []]));

    		for (const edge of edges) {
    			if (adj.has(edge.from)) {
    				adj.get(edge.from).push(edge.to);
    			}
    		}

    		const queue = [inputNode];
    		const seen = new Set([inputNode]);

    		while (queue.length > 0) {
    			const curr = queue.shift();

    			if (curr === outputNode) {
    				return [inputNode, outputNode]; // Found a path, return non-empty array
    			}

    			const successors = adj.get(curr) || [];

    			for (const successor of successors) {
    				if (!seen.has(successor)) {
    					seen.add(successor);
    					queue.push(successor);
    				}
    			}
    		}

    		return []; // No path found
    	}

    	// Reactive flag: whether there is a valid path from input to output
    	let hasPath = false;

    	async function runCommand(stdin, cmd) {
    		let result = "";

    		try {
    			result = await invoke("run_command", { stdin, cmd });
    			console.log(`Command executed: ${cmd} with result:`, result);
    		} catch(error) {
    			result = `Error here: ${error}`;
    		}

    		return result;
    	}

    	// async function runCommand(cmd, input) {
    	//     // If no command provided, do not forward input by default
    	//     if (!cmd) return "";
    	//     // Replace template variable {input} with actual data
    	//     const expanded = cmd.replace(/{input}/g, input);
    	//     // Helper to invoke Tauri backend if available
    	//     async function invokeTauri(command) {
    	//         try {
    	//             const { invoke: tauriInvoke } = await import(
    	//                 "@tauri-apps/api/tauri"
    	//             );
    	//             return await tauriInvoke("run_command", { cmd: command });
    	//         } catch (e) {
    	//             return `Error executing command: ${e}`;
    	//         }
    	//     }
    	//     // If the command uses shell features (e.g. multiple commands), delegate to backend shell
    	//     // Fallback: run command via backend shell
    	//     try {
    	//         const { invoke: tauriInvoke } = await import(
    	//             "@tauri-apps/api/tauri"
    	//         );
    	//         return await tauriInvoke("run_command", { cmd: expanded });
    	//     } catch (e) {
    	//         console.error("Error invoking Tauri command:", e);
    	//     }
    	//     return "Simulating: " + expanded;
    	// }
    	async function playPipeline() {
    		if (isRunning) return;
    		const nodes = scene.filter(s => s.type === "circle");
    		const edges = scene.filter(s => s.type === "edge");
    		const inputNode = nodes.find(n => n.role === "input");
    		let outputNode = nodes.find(n => n.role === "output");

    		if (!inputNode || !outputNode) {
    			alert("Input and Output nodes must be defined.");
    			return;
    		}

    		// Build graph and in-degrees
    		const adj = new Map(nodes.map(n => [n, []]));

    		const inDegree = new Map(nodes.map(n => [n, 0]));

    		edges.forEach(edge => {
    			if (adj.has(edge.from)) {
    				adj.get(edge.from).push(edge.to);
    			}

    			if (inDegree.has(edge.to)) {
    				inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    			}
    		});

    		$$invalidate(3, isRunning = true);
    		abort = false;
    		const nodeOutputs = new Map();
    		const executedNodes = new Set();
    		let queue = [];

    		// Start with nodes that have no incoming edges (usually just the input node)
    		for (const [node, degree] of inDegree.entries()) {
    			if (degree === 0) {
    				queue.push(node);
    			}
    		}

    		// Set initial input
    		if (inputNode) {
    			nodeOutputs.set(inputNode, inputNode.inputText);
    		}

    		// Prepare environment variables from input node
    		const envVars = (inputNode.envVars || []).filter(e => e.key && e.value);

    		const envPrefix = envVars.length > 0
    		? envVars.map(e => `${e.key}='${e.value}'`).join("; ") + "; "
    		: "";

    		while (queue.length > 0 && !abort) {
    			const currentBatch = queue;
    			queue = [];

    			// Highlight all nodes in the current batch
    			scene.forEach(s => s.highlight = false);

    			currentBatch.forEach(node => node.highlight = true);
    			$$invalidate(1, scene = [...scene]);

    			const promises = currentBatch.map(async node => {
    				if (abort) return;
    				$$invalidate(20, currentNode = node);

    				// Gather inputs from parent nodes
    				const parentEdges = edges.filter(e => e.to === node);

    				let inputData;

    				if (node.role === "input") {
    					inputData = node.inputText;
    				} else {
    					const parentOutputs = parentEdges.map(e => {
    						if (!nodeOutputs.has(e.from)) {
    							console.error(`Output not found for parent ${e.from.name} of ${node.name}`);
    							return "";
    						}

    						return nodeOutputs.get(e.from);
    					});

    					inputData = parentOutputs.join("\n");
    				}

    				let outputData = inputData;

    				if (node.role === "default") {
    					const rawCmd = node.command.trim().replace(/{input}/g, inputData);
    					const cmd = envPrefix ? `${envPrefix}${rawCmd}` : rawCmd;
    					console.log(`Running command on node ${node.name}: ${cmd}`);
    					outputData = await runCommand(inputData, cmd);
    					node.outputText = outputData;
    				} else if (node.role === "output") {
    					node.outputText = inputData;
    				}

    				nodeOutputs.set(node, outputData);
    				executedNodes.add(node);

    				// Add successors to the next batch if all their parents are done
    				const successors = adj.get(node) || [];

    				for (const successor of successors) {
    					const parentsOfSuccessor = edges.filter(e => e.to === successor).map(e => e.from);
    					const allParentsDone = parentsOfSuccessor.every(p => executedNodes.has(p));

    					if (allParentsDone) {
    						queue.push(successor);
    					}
    				}

    				$$invalidate(1, scene = [...scene]);
    			});

    			await Promise.all(promises);

    			if (!abort) {
    				await new Promise(r => setTimeout(r, 650));
    			}
    		}

    		$$invalidate(3, isRunning = false);
    		$$invalidate(20, currentNode = null);

    		// Clear highlights
    		scene.forEach(s => s.highlight = false);

    		// Select the output node to show the final result
    		outputNode = scene.find(s => s.role === "output");

    		if (outputNode) {
    			scene.forEach(s => s.selected = false);
    			outputNode.selected = true;
    		}

    		$$invalidate(1, scene = [...scene]);
    	}

    	function stopPipeline() {
    		abort = true;
    		$$invalidate(3, isRunning = false);
    	}

    	function newScene() {
    		$$invalidate(1, scene = [
    			{
    				type: "circle",
    				role: "input",
    				center: [-0.9, 0],
    				radius: 0.1,
    				color: ioColor,
    				selected: false,
    				inputText: "",
    				envVars: [],
    				name: "Input",
    				highlight: false
    			},
    			{
    				type: "circle",
    				role: "output",
    				center: [0.9, 0],
    				radius: 0.1,
    				color: ioColor,
    				selected: false,
    				outputText: "",
    				name: "Output",
    				highlight: false
    			}
    		]);

    		$$invalidate(2, sceneName = "Untitled Flow");
    	}

    	async function copyOutput() {
    		if (!selectedShape || !selectedShape.outputText) {
    			return;
    		}

    		try {
    			await navigator.clipboard.writeText(selectedShape.outputText);
    		} catch(err) {
    			console.error("Failed to copy output:", err);
    		}
    	}

    	async function importScene() {
    		const file = await open({
    			multiple: false,
    			directory: false,
    			filters: [{ name: "My Filter", extensions: ["yaml"] }]
    		});

    		const sceneYaml = await readTextFile(file);
    		const s = await parseFromYaml(sceneYaml);

    		// Validate scene structure
    		if (typeof s !== "object" || s === null || !s.scene || !Array.isArray(s.scene)) {
    			alert("Invalid scene format. Please check the YAML file.");
    			return;
    		}

    		$$invalidate(2, sceneName = s.name || "Untitled Flow");
    		const sceneData = s.scene;
    		const circles = sceneData.filter(item => item.type === "circle");

    		// Ensure input node has envVars property
    		circles.forEach(item => {
    			if (item.role === "input" && item.envVars == null) {
    				item.envVars = [];
    			}
    		});

    		const edgesRaw = sceneData.filter(item => item.type === "edge");
    		const newScene = [...circles];

    		edgesRaw.forEach(e => {
    			const fromNode = newScene.find(item => item.type === "circle" && item.name === e.from.name);
    			const toNode = newScene.find(item => item.type === "circle" && item.name === e.to.name);

    			if (fromNode && toNode) {
    				newScene.push({
    					type: "edge",
    					from: fromNode,
    					to: toNode,
    					color: e.color,
    					selected: e.selected,
    					highlight: e.highlight || false
    				});
    			}
    		});

    		$$invalidate(1, scene = newScene);

    		// HACK: This is a workaround to force Svelte to update the scene name
    		$$invalidate(2, sceneName);
    	}

    	// Prompt user to choose file path for exporting scene (dialog only)
    	async function exportScene() {
    		// Example filters: adjust name and extensions as needed
    		const path = await save({
    			filters: [{ name: "My Filter", extensions: ["yaml"] }]
    		});

    		// Path is null if dialog was cancelled
    		if (path) {
    			console.log("Selected export path:", path);
    		} else {
    			console.log("Save dialog was cancelled");
    		}

    		const yaml = parseToYaml({ name: sceneName, scene });
    		const file = await create(path, { overwrite: true });
    		await file.write(new TextEncoder().encode(yaml));
    		await file.close();
    	}

    	function handleSceneTitleBlur(e) {
    		if (e.target.innerText.trim() === "") {
    			$$invalidate(2, sceneName = "Untitled Flow");
    			e.target.innerText = "Untitled Flow";
    		} else {
    			$$invalidate(2, sceneName = e.target.innerText);
    		}
    	}

    	const writable_props = [];

    	Object$.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console$.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function h1$_binding$($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			sceneTitleEl = $$value;
    			$$invalidate(4, sceneTitleEl);
    		});
    	}

    	function textarea$_input_handler$() {
    		inspectorNode.inputText = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	function input$_input_handler$(each_value$_1, idx) {
    		each_value$_1[idx].key = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	const input_handler$ = () => $$invalidate(1, scene = [...scene]);

    	const click_handler$ = idx => {
    		inspectorNode.envVars.splice(idx, 1);
    		$$invalidate(1, scene = [...scene]);
    	};

    	function textarea$_input_handler$_1(each_value$_1, idx) {
    		each_value$_1[idx].value = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	const input_handler$_1 = () => $$invalidate(1, scene = [...scene]);

    	const click_handler$_1 = () => {
    		$$invalidate(8, inspectorNode.envVars = inspectorNode.envVars || [], inspectorNode);
    		inspectorNode.envVars.push({ key: "", value: "" });
    		$$invalidate(1, scene = [...scene]);
    	};

    	function textarea$_input_handler$_2() {
    		inspectorNode.outputText = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	function input$_input_handler$_1() {
    		inspectorNode.name = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	function textarea0$_input_handler$() {
    		inspectorNode.command = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	function textarea1$_input_handler$() {
    		inspectorNode.outputText = this.value;
    		((((((($$invalidate(8, inspectorNode), $$invalidate(3, isRunning)), $$invalidate(20, currentNode)), $$invalidate(19, selectedShape)), $$invalidate(0, canvas)), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    	}

    	function canvas$_binding$($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvas = $$value;
    			((($$invalidate(0, canvas), $$invalidate(1, scene)), $$invalidate(17, viewScale)), $$invalidate(18, viewOffset));
    		});
    	}

    	$$self.$capture_state = () => ({
    		invoke,
    		reglLib: regl,
    		onMount,
    		open,
    		save,
    		parseFromYaml,
    		parseToYaml,
    		create,
    		readTextFile,
    		sceneTitleEl,
    		canvas,
    		ioColor,
    		defaultNodeColor,
    		selectedColor,
    		highlightColor,
    		scene,
    		sceneName,
    		viewScale,
    		viewOffset,
    		labels,
    		panelWidth,
    		isResizing,
    		panelResizeStartX,
    		panelResizeStartWidth,
    		handlePanelResizeMouseDown,
    		handlePanelResizeMouseMove,
    		handlePanelResizeMouseUp,
    		addCircle,
    		selectedShape,
    		isRunning,
    		abort,
    		currentNode,
    		getPipelineNodes,
    		hasPath,
    		runCommand,
    		playPipeline,
    		stopPipeline,
    		newScene,
    		copyOutput,
    		importScene,
    		exportScene,
    		handleSceneTitleKeydown,
    		handleSceneTitleBlur,
    		inspectorNode
    	});

    	$$self.$inject_state = $$props => {
    		if ('sceneTitleEl' in $$props) $$invalidate(4, sceneTitleEl = $$props.sceneTitleEl);
    		if ('canvas' in $$props) $$invalidate(0, canvas = $$props.canvas);
    		if ('scene' in $$props) $$invalidate(1, scene = $$props.scene);
    		if ('sceneName' in $$props) $$invalidate(2, sceneName = $$props.sceneName);
    		if ('viewScale' in $$props) $$invalidate(17, viewScale = $$props.viewScale);
    		if ('viewOffset' in $$props) $$invalidate(18, viewOffset = $$props.viewOffset);
    		if ('labels' in $$props) $$invalidate(5, labels = $$props.labels);
    		if ('panelWidth' in $$props) $$invalidate(6, panelWidth = $$props.panelWidth);
    		if ('isResizing' in $$props) isResizing = $$props.isResizing;
    		if ('panelResizeStartX' in $$props) panelResizeStartX = $$props.panelResizeStartX;
    		if ('panelResizeStartWidth' in $$props) panelResizeStartWidth = $$props.panelResizeStartWidth;
    		if ('selectedShape' in $$props) $$invalidate(19, selectedShape = $$props.selectedShape);
    		if ('isRunning' in $$props) $$invalidate(3, isRunning = $$props.isRunning);
    		if ('abort' in $$props) abort = $$props.abort;
    		if ('currentNode' in $$props) $$invalidate(20, currentNode = $$props.currentNode);
    		if ('hasPath' in $$props) $$invalidate(7, hasPath = $$props.hasPath);
    		if ('inspectorNode' in $$props) $$invalidate(8, inspectorNode = $$props.inspectorNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*canvas, scene, viewScale, viewOffset*/ 393219) {
    			// Update screen-space labels below each node whenever relevant state changes
    			if (canvas) {
    				const w = canvas.clientWidth;
    				const h = canvas.clientHeight;

    				// Update canvas resolution to match CSS size
    				$$invalidate(0, canvas.width = w * window.devicePixelRatio, canvas);

    				$$invalidate(0, canvas.height = h * window.devicePixelRatio, canvas);

    				$$invalidate(5, labels = scene.filter(s => s.type === "circle").map(s => {
    					const xN = s.center[0] * viewScale + viewOffset[0];
    					const yN = s.center[1] * viewScale + viewOffset[1];
    					const xPx = (xN + 1) / 2 * w;

    					// Compute pixel radius in Y to place label just below the circle
    					const pixelRadius = s.radius * viewScale * (h / 2);

    					const margin = 4; // extra spacing below circle
    					const yPx = (1 - yN) / 2 * h + pixelRadius + margin;
    					return { x: xPx, y: yPx, name: s.name };
    				}));

    				// Active shape: prefer highlighted (during play), otherwise selected by user
    				$$invalidate(19, selectedShape = scene.find(s => s.type === "circle" && (s.highlight || s.selected)));
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isRunning, currentNode, selectedShape*/ 1572872) {
    			$$invalidate(8, inspectorNode = isRunning ? currentNode : selectedShape);
    		}

    		if ($$self.$$.dirty[0] & /*scene*/ 2) {
    			$$invalidate(7, hasPath = (() => {

    				return getPipelineNodes().length > 0;
    			})());
    		}

    		if ($$self.$$.dirty[0] & /*sceneName, scene*/ 6) {
    			if (typeof window !== "undefined") {
    				window.localStorage.setItem("scene", JSON.stringify({ name: sceneName, scene }));
    			}
    		}
    	};

    	return [
    		canvas,
    		scene,
    		sceneName,
    		isRunning,
    		sceneTitleEl,
    		labels,
    		panelWidth,
    		hasPath,
    		inspectorNode,
    		handlePanelResizeMouseDown,
    		playPipeline,
    		stopPipeline,
    		newScene,
    		copyOutput,
    		importScene,
    		exportScene,
    		handleSceneTitleBlur,
    		viewScale,
    		viewOffset,
    		selectedShape,
    		currentNode,
    		h1$_binding$,
    		textarea$_input_handler$,
    		input$_input_handler$,
    		input_handler$,
    		click_handler$,
    		textarea$_input_handler$_1,
    		input_handler$_1,
    		click_handler$_1,
    		textarea$_input_handler$_2,
    		input$_input_handler$_1,
    		textarea0$_input_handler$,
    		textarea1$_input_handler$,
    		canvas$_binding$
    	];
    }

    class App$ extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$, create_fragment, safe_not_equal, {}, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App$",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App$({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
