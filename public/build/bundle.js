var app = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	let src_url_equal_anchor;

	/**
	 * @param {string} element_src
	 * @param {string} url
	 * @returns {boolean}
	 */
	function src_url_equal(element_src, url) {
		if (element_src === url) return true;
		if (!src_url_equal_anchor) {
			src_url_equal_anchor = document.createElement('a');
		}
		// This is actually faster than doing URL(..).href
		src_url_equal_anchor.href = url;
		return element_src === src_url_equal_anchor.href;
	}

	/** @param {string} srcset */
	function split_srcset(srcset) {
		return srcset.split(',').map((src) => src.trim().split(' ').filter(Boolean));
	}

	/**
	 * @param {HTMLSourceElement | HTMLImageElement} element_srcset
	 * @param {string | undefined | null} srcset
	 * @returns {boolean}
	 */
	function srcset_url_equal(element_srcset, srcset) {
		const element_urls = split_srcset(element_srcset.srcset);
		const urls = split_srcset(srcset || '');

		return (
			urls.length === element_urls.length &&
			urls.every(
				([url, width], i) =>
					width === element_urls[i][1] &&
					// We need to test both ways because Vite will create an a full URL with
					// `new URL(asset, import.meta.url).href` for the client when `base: './'`, and the
					// relative URLs inside srcset are not automatically resolved to absolute URLs by
					// browsers (in contrast to img.src). This means both SSR and DOM code could
					// contain relative or absolute URLs.
					(src_url_equal(element_urls[i][0], url) || src_url_equal(url, element_urls[i][0]))
			)
		);
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function subscribe(store, ...callbacks) {
		if (store == null) {
			for (const callback of callbacks) {
				callback(undefined);
			}
			return noop;
		}
		const unsub = store.subscribe(...callbacks);
		return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}

	/** @returns {void} */
	function component_subscribe(component, store, callback) {
		component.$$.on_destroy.push(subscribe(store, callback));
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	/** @returns {{}} */
	function exclude_internal_props(props) {
		const result = {};
		for (const k in props) if (k[0] !== '$') result[k] = props[k];
		return result;
	}

	/** @returns {{}} */
	function compute_rest_props(props, keys) {
		const rest = {};
		keys = new Set(keys);
		for (const k in props) if (!keys.has(k) && k[0] !== '$') rest[k] = props[k];
		return rest;
	}

	function action_destroyer(action_result) {
		return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @returns {(event: any) => any} */
	function prevent_default(fn) {
		return function (event) {
			event.preventDefault();
			// @ts-ignore
			return fn.call(this, event);
		};
	}

	/**
	 * @returns {(event: any) => any} */
	function stop_propagation(fn) {
		return function (event) {
			event.stopPropagation();
			// @ts-ignore
			return fn.call(this, event);
		};
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}
	/**
	 * List of attributes that should always be set through the attr method,
	 * because updating them through the property setter doesn't work reliably.
	 * In the example of `width`/`height`, the problem is that the setter only
	 * accepts numeric values, but the attribute can also be set to a string like `50%`.
	 * If this list becomes too big, rethink this approach.
	 */
	const always_set_through_set_attribute = ['width', 'height'];

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {{ [x: string]: string }} attributes
	 * @returns {void}
	 */
	function set_attributes(node, attributes) {
		// @ts-ignore
		const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
		for (const key in attributes) {
			if (attributes[key] == null) {
				node.removeAttribute(key);
			} else if (key === 'style') {
				node.style.cssText = attributes[key];
			} else if (key === '__value') {
				/** @type {any} */ (node).value = node[key] = attributes[key];
			} else if (
				descriptors[key] &&
				descriptors[key].set &&
				always_set_through_set_attribute.indexOf(key) === -1
			) {
				node[key] = attributes[key];
			} else {
				attr(node, key, attributes[key]);
			}
		}
	}

	/**
	 * @param {Record<string, unknown>} data_map
	 * @returns {void}
	 */
	function set_custom_element_data_map(node, data_map) {
		Object.keys(data_map).forEach((key) => {
			set_custom_element_data(node, key, data_map[key]);
		});
	}

	/**
	 * @returns {void} */
	function set_custom_element_data(node, prop, value) {
		const lower = prop.toLowerCase(); // for backwards compatibility with existing behavior we do lowercase first
		if (lower in node) {
			node[lower] = typeof node[lower] === 'boolean' && value === '' ? true : value;
		} else if (prop in node) {
			node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
		} else {
			attr(node, prop, value);
		}
	}

	/**
	 * @param {string} tag
	 */
	function set_dynamic_element_data(tag) {
		return /-/.test(tag) ? set_custom_element_data_map : set_attributes;
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data(text, data) {
		data = '' + data;
		if (text.data === data) return;
		text.data = /** @type {string} */ (data);
	}

	/**
	 * @returns {void} */
	function set_input_value(input, value) {
		input.value = value == null ? '' : value;
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}

	function construct_svelte_component(component, props) {
		return new component(props);
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * Schedules a callback to run immediately before the component is updated after any state change.
	 *
	 * The first time the callback runs will be before the initial `onMount`
	 *
	 * https://svelte.dev/docs/svelte#beforeupdate
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function beforeUpdate(fn) {
		get_current_component().$$.before_update.push(fn);
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	/**
	 * Schedules a callback to run immediately after the component has been updated.
	 *
	 * The first time the callback runs will be after the initial `onMount`
	 *
	 * https://svelte.dev/docs/svelte#afterupdate
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function afterUpdate(fn) {
		get_current_component().$$.after_update.push(fn);
	}

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Creates an event dispatcher that can be used to dispatch [component events](https://svelte.dev/docs#template-syntax-component-directives-on-eventname).
	 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
	 *
	 * Component events created with `createEventDispatcher` create a
	 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
	 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
	 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
	 * property and can contain any type of data.
	 *
	 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
	 * ```ts
	 * const dispatch = createEventDispatcher<{
	 *  loaded: never; // does not take a detail argument
	 *  change: string; // takes a detail argument of type string, which is required
	 *  optional: number | null; // takes an optional detail argument of type number
	 * }>();
	 * ```
	 *
	 * https://svelte.dev/docs/svelte#createeventdispatcher
	 * @template {Record<string, any>} [EventMap=any]
	 * @returns {import('./public.js').EventDispatcher<EventMap>}
	 */
	function createEventDispatcher() {
		const component = get_current_component();
		return (type, detail, { cancelable = false } = {}) => {
			const callbacks = component.$$.callbacks[type];
			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
				callbacks.slice().forEach((fn) => {
					fn.call(component, event);
				});
				return !event.defaultPrevented;
			}
			return true;
		};
	}

	/**
	 * Retrieves the context that belongs to the closest parent component with the specified `key`.
	 * Must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#getcontext
	 * @template T
	 * @param {any} key
	 * @returns {T}
	 */
	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	/**
	 * @param component
	 * @param event
	 * @returns {void}
	 */
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];
		if (callbacks) {
			// @ts-ignore
			callbacks.slice().forEach((fn) => fn.call(this, event));
		}
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {Promise<void>} */
	function tick() {
		schedule_update();
		return resolved_promise;
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	/** @returns {void} */
	function add_flush_callback(fn) {
		flush_callbacks.push(fn);
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

	/** @returns {void} */
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
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
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

	/** @returns {void} */
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
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	// keyed each functions:

	/** @returns {void} */
	function destroy_block(block, lookup) {
		block.d(1);
		lookup.delete(block.key);
	}

	/** @returns {any[]} */
	function update_keyed_each(
		old_blocks,
		dirty,
		get_key,
		dynamic,
		ctx,
		list,
		lookup,
		node,
		destroy,
		create_each_block,
		next,
		get_context
	) {
		let o = old_blocks.length;
		let n = list.length;
		let i = o;
		const old_indexes = {};
		while (i--) old_indexes[old_blocks[i].key] = i;
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
			} else if (dynamic) {
				// defer updates until all the DOM shuffling is done
				updates.push(() => block.p(child_ctx, dirty));
			}
			new_lookup.set(key, (new_blocks[i] = block));
			if (key in old_indexes) deltas.set(key, Math.abs(i - old_indexes[key]));
		}
		const will_move = new Set();
		const did_move = new Set();
		/** @returns {void} */
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
			} else if (!new_lookup.has(old_key)) {
				// remove old block
				destroy(old_block, lookup);
				o--;
			} else if (!lookup.has(new_key) || will_move.has(new_key)) {
				insert(new_block);
			} else if (did_move.has(old_key)) {
				o--;
			} else if (deltas.get(new_key) > deltas.get(old_key)) {
				did_move.add(new_key);
				insert(new_block);
			} else {
				will_move.add(old_key);
				o--;
			}
		}
		while (o--) {
			const old_block = old_blocks[o];
			if (!new_lookup.has(old_block.key)) destroy(old_block, lookup);
		}
		while (n) insert(new_blocks[n - 1]);
		run_all(updates);
		return new_blocks;
	}

	/** @returns {{}} */
	function get_spread_update(levels, updates) {
		const update = {};
		const to_null_out = {};
		const accounted_for = { $$scope: 1 };
		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];
			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}
				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}
				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}
		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}
		return update;
	}

	function get_spread_object(spread_props) {
		return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
	}

	/** @returns {void} */
	function bind(component, name, callback) {
		const index = component.$$.props[name];
		if (index !== undefined) {
			component.$$.bound[index] = callback;
			callback(component.$$.ctx[index]);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
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

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
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
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
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
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	const PUBLIC_VERSION = '4';

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	const subscriber_queue = [];

	/**
	 * Creates a `Readable` store that allows reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#readable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Readable<T>}
	 */
	function readable(value, start) {
		return {
			subscribe: writable(value, start).subscribe
		};
	}

	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#writable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Writable<T>}
	 */
	function writable(value, start = noop) {
		/** @type {import('./public.js').Unsubscriber} */
		let stop;
		/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
		const subscribers = new Set();
		/** @param {T} new_value
		 * @returns {void}
		 */
		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (stop) {
					// store is ready
					const run_queue = !subscriber_queue.length;
					for (const subscriber of subscribers) {
						subscriber[1]();
						subscriber_queue.push(subscriber, value);
					}
					if (run_queue) {
						for (let i = 0; i < subscriber_queue.length; i += 2) {
							subscriber_queue[i][0](subscriber_queue[i + 1]);
						}
						subscriber_queue.length = 0;
					}
				}
			}
		}

		/**
		 * @param {import('./public.js').Updater<T>} fn
		 * @returns {void}
		 */
		function update(fn) {
			set(fn(value));
		}

		/**
		 * @param {import('./public.js').Subscriber<T>} run
		 * @param {import('./private.js').Invalidator<T>} [invalidate]
		 * @returns {import('./public.js').Unsubscriber}
		 */
		function subscribe(run, invalidate = noop) {
			/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
			const subscriber = [run, invalidate];
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				stop = start(set, update) || noop;
			}
			run(value);
			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0 && stop) {
					stop();
					stop = null;
				}
			};
		}
		return { set, update, subscribe };
	}

	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 *
	 * https://svelte.dev/docs/svelte-store#derived
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @overload
	 * @param {S} stores - input stores
	 * @param {(values: import('./private.js').StoresValues<S>, set: (value: T) => void, update: (fn: import('./public.js').Updater<T>) => void) => import('./public.js').Unsubscriber | void} fn - function callback that aggregates the values
	 * @param {T} [initial_value] - initial value
	 * @returns {import('./public.js').Readable<T>}
	 */

	/**
	 * Derived value store by synchronizing one or more readable stores and
	 * applying an aggregation function over its input values.
	 *
	 * https://svelte.dev/docs/svelte-store#derived
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @overload
	 * @param {S} stores - input stores
	 * @param {(values: import('./private.js').StoresValues<S>) => T} fn - function callback that aggregates the values
	 * @param {T} [initial_value] - initial value
	 * @returns {import('./public.js').Readable<T>}
	 */

	/**
	 * @template {import('./private.js').Stores} S
	 * @template T
	 * @param {S} stores
	 * @param {Function} fn
	 * @param {T} [initial_value]
	 * @returns {import('./public.js').Readable<T>}
	 */
	function derived(stores, fn, initial_value) {
		const single = !Array.isArray(stores);
		/** @type {Array<import('./public.js').Readable<any>>} */
		const stores_array = single ? [stores] : stores;
		if (!stores_array.every(Boolean)) {
			throw new Error('derived() expects stores as input, got a falsy value');
		}
		const auto = fn.length < 2;
		return readable(initial_value, (set, update) => {
			let started = false;
			const values = [];
			let pending = 0;
			let cleanup = noop;
			const sync = () => {
				if (pending) {
					return;
				}
				cleanup();
				const result = fn(single ? values[0] : values, set, update);
				if (auto) {
					set(result);
				} else {
					cleanup = is_function(result) ? result : noop;
				}
			};
			const unsubscribers = stores_array.map((store, i) =>
				subscribe(
					store,
					(value) => {
						values[i] = value;
						pending &= ~(1 << i);
						if (started) {
							sync();
						}
					},
					() => {
						pending |= 1 << i;
					}
				)
			);
			started = true;
			sync();
			return function stop() {
				run_all(unsubscribers);
				cleanup();
				// We need to set this to false because callbacks can still happen despite having unsubscribed:
				// Callbacks might already be placed in the queue which doesn't know it should no longer
				// invoke this derived store.
				started = false;
			};
		});
	}

	function parse(str, loose) {
		if (str instanceof RegExp) return { keys:false, pattern:str };
		var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
		arr[0] || arr.shift();

		while (tmp = arr.shift()) {
			c = tmp[0];
			if (c === '*') {
				keys.push('wild');
				pattern += '/(.*)';
			} else if (c === ':') {
				o = tmp.indexOf('?', 1);
				ext = tmp.indexOf('.', 1);
				keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
				pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
				if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
			} else {
				pattern += '/' + tmp;
			}
		}

		return {
			keys: keys,
			pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
		};
	}

	/* node_modules/svelte-spa-router/Router.svelte generated by Svelte v4.2.12 */

	function create_else_block$5(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;
		const switch_instance_spread_levels = [/*props*/ ctx[2]];
		var switch_value = /*component*/ ctx[0];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {};

			for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}

			if (dirty !== undefined && dirty & /*props*/ 4) {
				switch_instance_props = assign(switch_instance_props, get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])]));
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty & /*component*/ 1 && switch_value !== (switch_value = /*component*/ ctx[0])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						switch_instance.$on("routeEvent", /*routeEvent_handler_1*/ ctx[7]);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty & /*props*/ 4)
					? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*props*/ ctx[2])])
					: {};

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	// (239:0) {#if componentParams}
	function create_if_block$a(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;
		const switch_instance_spread_levels = [{ params: /*componentParams*/ ctx[1] }, /*props*/ ctx[2]];
		var switch_value = /*component*/ ctx[0];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {};

			for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}

			if (dirty !== undefined && dirty & /*componentParams, props*/ 6) {
				switch_instance_props = assign(switch_instance_props, get_spread_update(switch_instance_spread_levels, [
					dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
					dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
				]));
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty & /*component*/ 1 && switch_value !== (switch_value = /*component*/ ctx[0])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						switch_instance.$on("routeEvent", /*routeEvent_handler*/ ctx[6]);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty & /*componentParams, props*/ 6)
					? get_spread_update(switch_instance_spread_levels, [
							dirty & /*componentParams*/ 2 && { params: /*componentParams*/ ctx[1] },
							dirty & /*props*/ 4 && get_spread_object(/*props*/ ctx[2])
						])
					: {};

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	function create_fragment$m(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block$a, create_else_block$5];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*componentParams*/ ctx[1]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	function getLocation() {
		const hashPosition = window.location.href.indexOf('#/');

		let location = hashPosition > -1
		? window.location.href.substr(hashPosition + 1)
		: '/';

		// Check if there's a querystring
		const qsPosition = location.indexOf('?');

		let querystring = '';

		if (qsPosition > -1) {
			querystring = location.substr(qsPosition + 1);
			location = location.substr(0, qsPosition);
		}

		return { location, querystring };
	}

	const loc = readable(null, // eslint-disable-next-line prefer-arrow-callback
	function start(set) {
		set(getLocation());

		const update = () => {
			set(getLocation());
		};

		window.addEventListener('hashchange', update, false);

		return function stop() {
			window.removeEventListener('hashchange', update, false);
		};
	});

	const location$1 = derived(loc, _loc => _loc.location);
	derived(loc, _loc => _loc.querystring);
	const params = writable(undefined);

	function link(node, opts) {
		opts = linkOpts(opts);

		// Only apply to <a> tags
		if (!node || !node.tagName || node.tagName.toLowerCase() != 'a') {
			throw Error('Action "link" can only be used with <a> tags');
		}

		updateLink(node, opts);

		return {
			update(updated) {
				updated = linkOpts(updated);
				updateLink(node, updated);
			}
		};
	}

	function restoreScroll(state) {
		// If this exists, then this is a back navigation: restore the scroll position
		if (state) {
			window.scrollTo(state.__svelte_spa_router_scrollX, state.__svelte_spa_router_scrollY);
		} else {
			// Otherwise this is a forward navigation: scroll to top
			window.scrollTo(0, 0);
		}
	}

	// Internal function used by the link function
	function updateLink(node, opts) {
		let href = opts.href || node.getAttribute('href');

		// Destination must start with '/' or '#/'
		if (href && href.charAt(0) == '/') {
			// Add # to the href attribute
			href = '#' + href;
		} else if (!href || href.length < 2 || href.slice(0, 2) != '#/') {
			throw Error('Invalid value for "href" attribute: ' + href);
		}

		node.setAttribute('href', href);

		node.addEventListener('click', event => {
			// Prevent default anchor onclick behaviour
			event.preventDefault();

			if (!opts.disabled) {
				scrollstateHistoryHandler(event.currentTarget.getAttribute('href'));
			}
		});
	}

	// Internal function that ensures the argument of the link action is always an object
	function linkOpts(val) {
		if (val && typeof val == 'string') {
			return { href: val };
		} else {
			return val || {};
		}
	}

	/**
	 * The handler attached to an anchor tag responsible for updating the
	 * current history state with the current scroll state
	 *
	 * @param {string} href - Destination
	 */
	function scrollstateHistoryHandler(href) {
		// Setting the url (3rd arg) to href will break clicking for reasons, so don't try to do that
		history.replaceState(
			{
				...history.state,
				__svelte_spa_router_scrollX: window.scrollX,
				__svelte_spa_router_scrollY: window.scrollY
			},
			undefined
		);

		// This will force an update as desired, but this time our scroll state will be attached
		window.location.hash = href;
	}

	function instance$j($$self, $$props, $$invalidate) {
		let { routes = {} } = $$props;
		let { prefix = '' } = $$props;
		let { restoreScrollState = false } = $$props;

		/**
	 * Container for a route: path, component
	 */
		class RouteItem {
			/**
	 * Initializes the object and creates a regular expression from the path, using regexparam.
	 *
	 * @param {string} path - Path to the route (must start with '/' or '*')
	 * @param {SvelteComponent|WrappedComponent} component - Svelte component for the route, optionally wrapped
	 */
			constructor(path, component) {
				if (!component || typeof component != 'function' && (typeof component != 'object' || component._sveltesparouter !== true)) {
					throw Error('Invalid component object');
				}

				// Path must be a regular or expression, or a string starting with '/' or '*'
				if (!path || typeof path == 'string' && (path.length < 1 || path.charAt(0) != '/' && path.charAt(0) != '*') || typeof path == 'object' && !(path instanceof RegExp)) {
					throw Error('Invalid value for "path" argument - strings must start with / or *');
				}

				const { pattern, keys } = parse(path);
				this.path = path;

				// Check if the component is wrapped and we have conditions
				if (typeof component == 'object' && component._sveltesparouter === true) {
					this.component = component.component;
					this.conditions = component.conditions || [];
					this.userData = component.userData;
					this.props = component.props || {};
				} else {
					// Convert the component to a function that returns a Promise, to normalize it
					this.component = () => Promise.resolve(component);

					this.conditions = [];
					this.props = {};
				}

				this._pattern = pattern;
				this._keys = keys;
			}

			/**
	 * Checks if `path` matches the current route.
	 * If there's a match, will return the list of parameters from the URL (if any).
	 * In case of no match, the method will return `null`.
	 *
	 * @param {string} path - Path to test
	 * @returns {null|Object.<string, string>} List of paramters from the URL if there's a match, or `null` otherwise.
	 */
			match(path) {
				// If there's a prefix, check if it matches the start of the path.
				// If not, bail early, else remove it before we run the matching.
				if (prefix) {
					if (typeof prefix == 'string') {
						if (path.startsWith(prefix)) {
							path = path.substr(prefix.length) || '/';
						} else {
							return null;
						}
					} else if (prefix instanceof RegExp) {
						const match = path.match(prefix);

						if (match && match[0]) {
							path = path.substr(match[0].length) || '/';
						} else {
							return null;
						}
					}
				}

				// Check if the pattern matches
				const matches = this._pattern.exec(path);

				if (matches === null) {
					return null;
				}

				// If the input was a regular expression, this._keys would be false, so return matches as is
				if (this._keys === false) {
					return matches;
				}

				const out = {};
				let i = 0;

				while (i < this._keys.length) {
					// In the match parameters, URL-decode all values
					try {
						out[this._keys[i]] = decodeURIComponent(matches[i + 1] || '') || null;
					} catch(e) {
						out[this._keys[i]] = null;
					}

					i++;
				}

				return out;
			}

			/**
	 * Dictionary with route details passed to the pre-conditions functions, as well as the `routeLoading`, `routeLoaded` and `conditionsFailed` events
	 * @typedef {Object} RouteDetail
	 * @property {string|RegExp} route - Route matched as defined in the route definition (could be a string or a reguar expression object)
	 * @property {string} location - Location path
	 * @property {string} querystring - Querystring from the hash
	 * @property {object} [userData] - Custom data passed by the user
	 * @property {SvelteComponent} [component] - Svelte component (only in `routeLoaded` events)
	 * @property {string} [name] - Name of the Svelte component (only in `routeLoaded` events)
	 */
			/**
	 * Executes all conditions (if any) to control whether the route can be shown. Conditions are executed in the order they are defined, and if a condition fails, the following ones aren't executed.
	 * 
	 * @param {RouteDetail} detail - Route detail
	 * @returns {boolean} Returns true if all the conditions succeeded
	 */
			async checkConditions(detail) {
				for (let i = 0; i < this.conditions.length; i++) {
					if (!await this.conditions[i](detail)) {
						return false;
					}
				}

				return true;
			}
		}

		// Set up all routes
		const routesList = [];

		if (routes instanceof Map) {
			// If it's a map, iterate on it right away
			routes.forEach((route, path) => {
				routesList.push(new RouteItem(path, route));
			});
		} else {
			// We have an object, so iterate on its own properties
			Object.keys(routes).forEach(path => {
				routesList.push(new RouteItem(path, routes[path]));
			});
		}

		// Props for the component to render
		let component = null;

		let componentParams = null;
		let props = {};

		// Event dispatcher from Svelte
		const dispatch = createEventDispatcher();

		// Just like dispatch, but executes on the next iteration of the event loop
		async function dispatchNextTick(name, detail) {
			// Execute this code when the current call stack is complete
			await tick();

			dispatch(name, detail);
		}

		// If this is set, then that means we have popped into this var the state of our last scroll position
		let previousScrollState = null;

		let popStateChanged = null;

		if (restoreScrollState) {
			popStateChanged = event => {
				// If this event was from our history.replaceState, event.state will contain
				// our scroll history. Otherwise, event.state will be null (like on forward
				// navigation)
				if (event.state && (event.state.__svelte_spa_router_scrollY || event.state.__svelte_spa_router_scrollX)) {
					previousScrollState = event.state;
				} else {
					previousScrollState = null;
				}
			};

			// This is removed in the destroy() invocation below
			window.addEventListener('popstate', popStateChanged);

			afterUpdate(() => {
				restoreScroll(previousScrollState);
			});
		}

		// Always have the latest value of loc
		let lastLoc = null;

		// Current object of the component loaded
		let componentObj = null;

		// Handle hash change events
		// Listen to changes in the $loc store and update the page
		// Do not use the $: syntax because it gets triggered by too many things
		const unsubscribeLoc = loc.subscribe(async newLoc => {
			lastLoc = newLoc;

			// Find a route matching the location
			let i = 0;

			while (i < routesList.length) {
				const match = routesList[i].match(newLoc.location);

				if (!match) {
					i++;
					continue;
				}

				const detail = {
					route: routesList[i].path,
					location: newLoc.location,
					querystring: newLoc.querystring,
					userData: routesList[i].userData,
					params: match && typeof match == 'object' && Object.keys(match).length
					? match
					: null
				};

				// Check if the route can be loaded - if all conditions succeed
				if (!await routesList[i].checkConditions(detail)) {
					// Don't display anything
					$$invalidate(0, component = null);

					componentObj = null;

					// Trigger an event to notify the user, then exit
					dispatchNextTick('conditionsFailed', detail);

					return;
				}

				// Trigger an event to alert that we're loading the route
				// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
				dispatchNextTick('routeLoading', Object.assign({}, detail));

				// If there's a component to show while we're loading the route, display it
				const obj = routesList[i].component;

				// Do not replace the component if we're loading the same one as before, to avoid the route being unmounted and re-mounted
				if (componentObj != obj) {
					if (obj.loading) {
						$$invalidate(0, component = obj.loading);
						componentObj = obj;
						$$invalidate(1, componentParams = obj.loadingParams);
						$$invalidate(2, props = {});

						// Trigger the routeLoaded event for the loading component
						// Create a copy of detail so we don't modify the object for the dynamic route (and the dynamic route doesn't modify our object too)
						dispatchNextTick('routeLoaded', Object.assign({}, detail, {
							component,
							name: component.name,
							params: componentParams
						}));
					} else {
						$$invalidate(0, component = null);
						componentObj = null;
					}

					// Invoke the Promise
					const loaded = await obj();

					// Now that we're here, after the promise resolved, check if we still want this component, as the user might have navigated to another page in the meanwhile
					if (newLoc != lastLoc) {
						// Don't update the component, just exit
						return;
					}

					// If there is a "default" property, which is used by async routes, then pick that
					$$invalidate(0, component = loaded && loaded.default || loaded);

					componentObj = obj;
				}

				// Set componentParams only if we have a match, to avoid a warning similar to `<Component> was created with unknown prop 'params'`
				// Of course, this assumes that developers always add a "params" prop when they are expecting parameters
				if (match && typeof match == 'object' && Object.keys(match).length) {
					$$invalidate(1, componentParams = match);
				} else {
					$$invalidate(1, componentParams = null);
				}

				// Set static props, if any
				$$invalidate(2, props = routesList[i].props);

				// Dispatch the routeLoaded event then exit
				// We need to clone the object on every event invocation so we don't risk the object to be modified in the next tick
				dispatchNextTick('routeLoaded', Object.assign({}, detail, {
					component,
					name: component.name,
					params: componentParams
				})).then(() => {
					params.set(componentParams);
				});

				return;
			}

			// If we're still here, there was no match, so show the empty component
			$$invalidate(0, component = null);

			componentObj = null;
			params.set(undefined);
		});

		onDestroy(() => {
			unsubscribeLoc();
			popStateChanged && window.removeEventListener('popstate', popStateChanged);
		});

		function routeEvent_handler(event) {
			bubble.call(this, $$self, event);
		}

		function routeEvent_handler_1(event) {
			bubble.call(this, $$self, event);
		}

		$$self.$$set = $$props => {
			if ('routes' in $$props) $$invalidate(3, routes = $$props.routes);
			if ('prefix' in $$props) $$invalidate(4, prefix = $$props.prefix);
			if ('restoreScrollState' in $$props) $$invalidate(5, restoreScrollState = $$props.restoreScrollState);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*restoreScrollState*/ 32) {
				// Update history.scrollRestoration depending on restoreScrollState
				history.scrollRestoration = restoreScrollState ? 'manual' : 'auto';
			}
		};

		return [
			component,
			componentParams,
			props,
			routes,
			prefix,
			restoreScrollState,
			routeEvent_handler,
			routeEvent_handler_1
		];
	}

	class Router extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$j, create_fragment$m, safe_not_equal, {
				routes: 3,
				prefix: 4,
				restoreScrollState: 5
			});
		}
	}

	const rentals = [
	    {
	        name: "Marée basse",
	        location: "Saint-Vincent-Sur-Jard",
	        details: "4 Bedroom | 3 Bathroom | Sleeps 6",
	        imageUrl: "src/assets/imageGites/MB.jpg",
	        link: "/#/basse" 
	    },
	    {
	        name: "Marée haute",
	        location: "Saint-Vincent-Sur-Jard",
	        details: "3 Bedroom | 3 Bathroom | Sleeps 6",
	        imageUrl: "src/assets/imageGites/MH.jpg",
	        link: "/#/haute"  
	    },
	    {
	        name: "Étale",
	        location: "Saint-Vincent-Sur-Jard",
	        details: "3 Bedroom | 3 Bathroom | Sleeps 6",
	        imageUrl: "src/assets/imageGites/etale.jpg",
	        link: "/#/etale" 
	    },
	];

	/* src/components/Card.svelte generated by Svelte v4.2.12 */

	function get_each_context$9(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[1] = list[i].name;
		child_ctx[2] = list[i].location;
		child_ctx[3] = list[i].details;
		child_ctx[4] = list[i].imageUrl;
		child_ctx[5] = list[i].link;
		return child_ctx;
	}

	// (14:8) {#each rentals as { name, location, details, imageUrl, link }}
	function create_each_block$9(ctx) {
		let div1;
		let img;
		let img_src_value;
		let t0;
		let div0;
		let h2;
		let t2;
		let p0;
		let t4;
		let p1;
		let t6;
		let a;
		let t9;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[0](/*link*/ ctx[5]);
		}

		return {
			c() {
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				h2 = element("h2");
				h2.textContent = `${/*name*/ ctx[1]}`;
				t2 = space();
				p0 = element("p");
				p0.textContent = `${/*location*/ ctx[2]}`;
				t4 = space();
				p1 = element("p");
				p1.textContent = `${/*details*/ ctx[3]}`;
				t6 = space();
				a = element("a");
				a.textContent = `En savoir plus sur ${/*name*/ ctx[1]}`;
				t9 = space();
				attr(img, "class", "rental-image");
				if (!src_url_equal(img.src, img_src_value = /*imageUrl*/ ctx[4])) attr(img, "src", img_src_value);
				attr(img, "alt", /*name*/ ctx[1] + " image");
				attr(h2, "class", "textCardH2");
				attr(p0, "class", "textCard");
				attr(p1, "class", "textCard");
				attr(a, "class", "textCard linkCard");
				attr(a, "href", /*link*/ ctx[5]);
				attr(div0, "class", "rental-card");
				attr(div1, "class", "imageGites");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(div0, h2);
				append(div0, t2);
				append(div0, p0);
				append(div0, t4);
				append(div0, p1);
				append(div0, t6);
				append(div0, a);
				append(div1, t9);

				if (!mounted) {
					dispose = listen(a, "click", prevent_default(click_handler));
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				mounted = false;
				dispose();
			}
		};
	}

	function create_fragment$l(ctx) {
		let section;
		let h1;
		let t2;
		let div;
		let each_value = ensure_array_like(rentals);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$9(get_each_context$9(ctx, each_value, i));
		}

		return {
			c() {
				section = element("section");
				h1 = element("h1");
				h1.innerHTML = `Au Cœur de la Nature <br/> Nos Gîtes à Louer`;
				t2 = space();
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(h1, "class", "title");
				attr(div, "class", "gites-rental");
				attr(section, "class", "section3");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, h1);
				append(section, t2);
				append(section, div);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*redirectToLink*/ 0) {
					each_value = ensure_array_like(rentals);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$9(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$9(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function redirectToLink(link) {
		window.location.href = link;
	}

	function instance$i($$self) {
		const click_handler = link => redirectToLink(link);
		return [click_handler];
	}

	class Card extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$i, create_fragment$l, safe_not_equal, {});
		}
	}

	const images$3 = [
	    {
	        alt: 'Description de l\'image 1',
	        src: 'src/assets/imgCarousel/pictureHome.webp',
	        title: 'Titre de l\'image 1'
	      },
	      {
	        alt: 'Description de l\'image 2',
	        src: 'src/assets/imgCarousel/pictureHome1.webp',
	        title: 'Titre de l\'image 2'
	      },

	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome2.webp',
	        title: 'Titre de l\'image '
	      },

	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome3.webp',
	        title: 'Titre de l\'image '
	      },


	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome4.webp',
	        title: 'Titre de l\'image '
	      },
	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome5.webp',
	        title: 'Titre de l\'image '
	      },
	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome6.webp',
	        title: 'Titre de l\'image '
	      },
	      {
	        alt: 'Description de l\'image 3 ',
	        src: 'src/assets/imgCarousel/pictureHome7.webp',
	        title: 'Titre de l\'image '
	      },
	    {
	      alt: 'Description de l\'image 3 ',
	      src: 'src/assets/imgCarousel/pictureHome8.webp',
	      title: 'Titre de l\'image '
	    }
	  // ... Ajoutez d'autres objets d'image avec leurs propriétés
	];

	/* src/components/Slider.svelte generated by Svelte v4.2.12 */

	function get_each_context$8(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[4] = list[i].src;
		child_ctx[5] = list[i].alt;
		child_ctx[7] = i;
		return child_ctx;
	}

	// (73:6) {#each images as { src, alt }
	function create_each_block$8(ctx) {
		let img;
		let img_src_value;
		let img_srcset_value;
		let img_aria_hidden_value;

		return {
			c() {
				img = element("img");
				attr(img, "class", "carousel-image");
				if (!src_url_equal(img.src, img_src_value = /*src*/ ctx[4])) attr(img, "src", img_src_value);
				if (!srcset_url_equal(img, img_srcset_value = `${/*src*/ ctx[4]} 600w, ${/*src*/ ctx[4]} 1200w, ${/*src*/ ctx[4]} 2000w`)) attr(img, "srcset", img_srcset_value);
				attr(img, "sizes", "(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 25vw");
				attr(img, "alt", `Image ${/*index*/ ctx[7] + 1}: ${/*alt*/ ctx[5]}`);
				attr(img, "role", "presentation");
				attr(img, "aria-hidden", img_aria_hidden_value = /*index*/ ctx[7] !== /*currentImageIndex*/ ctx[0]);
				attr(img, "aria-labelledby", "carousel-heading");
				attr(img, "tabindex", "-1");
			},
			m(target, anchor) {
				insert(target, img, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*currentImageIndex*/ 1 && img_aria_hidden_value !== (img_aria_hidden_value = /*index*/ ctx[7] !== /*currentImageIndex*/ ctx[0])) {
					attr(img, "aria-hidden", img_aria_hidden_value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(img);
				}
			}
		};
	}

	function create_fragment$k(ctx) {
		let section;
		let div2;
		let t5;
		let div4;
		let div3;
		let div3_style_value;
		let each_value = ensure_array_like(images$3);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$8(get_each_context$8(ctx, each_value, i));
		}

		return {
			c() {
				section = element("section");
				div2 = element("div");
				div2.innerHTML = `<h1 id="carousel-heading" aria-label="Bienvenue à Saint Vincent sur Jard, Carousel" preload="">BIENVENUE <br/> A <br/> SAINT VINCENT SUR JARD</h1> <div class="logo-container"><img class="logo-slide" src="src/assets/logo.png" alt="Logo" loading="lazy"/></div> <div class="logo-region"><img class="logo-vendee" src="src/assets/logo-vendee.png" alt="Logo" loading="lazy"/></div>`;
				t5 = space();
				div4 = element("div");
				div3 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(div2, "class", "text-container top-text");
				attr(div3, "class", "image-carousel");
				attr(div3, "style", div3_style_value = `transform: translateX(${-/*currentImageIndex*/ ctx[0] * window.innerWidth}px); width: ${/*containerWidth*/ ctx[1]}px`);
				attr(div3, "role", "listbox");
				attr(div4, "class", "carousel-wrapper");
				attr(div4, "role", "group");
				attr(div4, "aria-roledescription", "image slider");
				attr(div4, "tabindex", "-1");
				attr(section, "class", "carousel-container");
				attr(section, "aria-label", "Carousel");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, div2);
				append(section, t5);
				append(section, div4);
				append(div4, div3);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div3, null);
					}
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*currentImageIndex*/ 1) {
					each_value = ensure_array_like(images$3);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$8(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$8(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div3, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}

				if (dirty & /*currentImageIndex, containerWidth*/ 3 && div3_style_value !== (div3_style_value = `transform: translateX(${-/*currentImageIndex*/ ctx[0] * window.innerWidth}px); width: ${/*containerWidth*/ ctx[1]}px`)) {
					attr(div3, "style", div3_style_value);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance$h($$self, $$props, $$invalidate) {
		let currentImageIndex = 0;
		let containerWidth = 0;

		// Fonction pour passer à l'image suivante
		function nextImage() {
			$$invalidate(0, currentImageIndex = (currentImageIndex + 1) % images$3.length);
		}

		// Effectué après le montage du composant
		onMount(() => {
			calculateContainerWidth();

			// Déclenche le changement d'image toutes les 5 secondes
			const interval = setInterval(
				() => {
					nextImage();
					calculateContainerWidth();
				},
				5000
			);

			// Nettoie l'intervalle après la mise à jour du composant
			return () => clearInterval(interval);
		});

		// Effectué après chaque mise à jour du composant
		afterUpdate(() => {
			calculateContainerWidth();
		});

		// Fonction pour calculer la largeur du conteneur en fonction du nombre d'images
		function calculateContainerWidth() {
			$$invalidate(1, containerWidth = images$3.length * window.innerWidth);
		}

		return [currentImageIndex, containerWidth];
	}

	class Slider extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$h, create_fragment$k, safe_not_equal, {});
		}
	}

	/* src/pages/Home.svelte generated by Svelte v4.2.12 */

	function create_fragment$j(ctx) {
		let section0;
		let slider;
		let t0;
		let section1;
		let card;
		let t1;
		let section2;
		let current;
		slider = new Slider({});
		card = new Card({});

		return {
			c() {
				section0 = element("section");
				create_component(slider.$$.fragment);
				t0 = space();
				section1 = element("section");
				create_component(card.$$.fragment);
				t1 = space();
				section2 = element("section");
				section2.innerHTML = `<div class="review"><h2 class="titleReview">Avis Clients</h2> <img class="guillemets" src="src/assets/public/guillemets-haut.svg" alt="" srcset=""/> <div class="elfsight-app-b60d04a1-b839-40ae-8a36-9a1dc3d8d03a reviewConteneur" data-elfsight-app-lazy=""><div class="under"></div></div> <img class="guillemets" src="src/assets/public/guillemets-bas.svg" alt=""/></div>`;
				attr(section1, "class", "cards");
				attr(section2, "class", "review");
			},
			m(target, anchor) {
				insert(target, section0, anchor);
				mount_component(slider, section0, null);
				insert(target, t0, anchor);
				insert(target, section1, anchor);
				mount_component(card, section1, null);
				insert(target, t1, anchor);
				insert(target, section2, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(slider.$$.fragment, local);
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(slider.$$.fragment, local);
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(section0);
					detach(t0);
					detach(section1);
					detach(t1);
					detach(section2);
				}

				destroy_component(slider);
				destroy_component(card);
			}
		};
	}

	function instance$g($$self) {
		onMount(() => {
			const script = document.createElement("script");
			script.src = "https://static.elfsight.com/platform/platform.js";
			script.dataset.useServiceCore = true;
			script.defer = true;
			document.body.appendChild(script);
		});

		return [];
	}

	class Home extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$g, create_fragment$j, safe_not_equal, {});
		}
	}

	/* src/pages/NotFound.svelte generated by Svelte v4.2.12 */

	function create_fragment$i(ctx) {
		let p;

		return {
			c() {
				p = element("p");
				p.textContent = "rien";
			},
			m(target, anchor) {
				insert(target, p, anchor);
			},
			p: noop,
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	class NotFound extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$i, safe_not_equal, {});
		}
	}

	let equipmentOutdoorItems = [
	    { id: 1, name: 'Barbecue',  alt:"Icône Barbecue", imageSrc: 'src/assets/equipement/barbecue.svg' },
	    { id: 2, name: 'Parking privé', alt:"Icône Parking privé", imageSrc: 'src/assets/equipement/park.svg' },
	    { id: 3, name: 'Jardin partagé',alt:"Icône Jardin partagé", imageSrc: 'src/assets/equipement/garde.svg' },
	    { id: 4, name: 'Chaise transat', alt:"Icône Chaise transat",  imageSrc: 'src/assets/equipement/deck_chair.svg' },
	    { id: 5, name: 'Salon de jardin', alt:"Icône Salon de jardin", imageSrc: 'src/assets/equipement/garden.svg' },
	    { id: 6, name: 'Terrasse privée', alt: "Icône Terrasse privée",  imageSrc: 'src/assets/equipement/privat.svg' }
	  ];

	const equipementsItems = [
	  
	  {
	    nom: "Drap (Lits faits à l'arrivée) ",
	    image: "src/assets/public/equipement/bedMade.svg",
	    alt: "Icône Draps et linge de toilette"
	  },
	    {
	      nom: "Serviette fournis ",
	      image: "src/assets/public/equipement/bedding.svg",
	      alt: "Icône Draps et linge de toilette"
	    },
	    {
	      nom: "Télévision",
	      image: "src/assets/public/equipement/tv.svg",
	      alt: "Icône Télévision"
	    },
	    {
	      nom: "Wifi",
	      image: "src/assets/public/equipement/wifi.svg",
	      alt: "Icône Wifi"
	    },
	  {
	      nom: "Jeux enfants",
	      image: "src/assets/public/equipement/balon.svg",
	      alt: "Balon"
	    }



	  ];
	  // Exportation par défaut

	/* src/components/Icon.svelte generated by Svelte v4.2.12 */

	function get_each_context$7(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[4] = list[i].id;
		child_ctx[5] = list[i].path;
		child_ctx[6] = list[i].title;
		child_ctx[7] = list[i].text;
		return child_ctx;
	}

	// (19:8) {#each svgPaths as { id, path, title, text }}
	function create_each_block$7(ctx) {
		let div1;
		let img;
		let img_src_value;
		let t0;
		let div0;
		let span;

		let t1_value = (/*accommodationData*/ ctx[0]
		? /*accommodationData*/ ctx[0][/*iconTextMap*/ ctx[2][/*id*/ ctx[4]].property] ?? ""
		: "") + "";

		let t1;
		let t2_value = /*iconTextMap*/ ctx[2][/*id*/ ctx[4]].suffix + "";
		let t2;
		let t3;

		return {
			c() {
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				span = element("span");
				t1 = text(t1_value);
				t2 = text(t2_value);
				t3 = space();
				attr(img, "class", "icons");
				if (!src_url_equal(img.src, img_src_value = /*path*/ ctx[5])) attr(img, "src", img_src_value);
				attr(img, "alt", /*title*/ ctx[6] || "Icon");
				attr(img, "aria-hidden", "true");
				attr(span, "class", "numberIcon");

				attr(span, "aria-label", "" + ((/*accommodationData*/ ctx[0]
				? /*accommodationData*/ ctx[0][/*iconTextMap*/ ctx[2][/*id*/ ctx[4]].property] ?? ''
				: '') + " " + /*iconTextMap*/ ctx[2][/*id*/ ctx[4]].suffix + " " + /*text*/ ctx[7]));

				attr(div0, "class", "textIcon");
				attr(div1, "class", "icon-wrapper");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(div0, span);
				append(span, t1);
				append(span, t2);
				append(div1, t3);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(div1);
				}
			}
		};
	}

	function create_fragment$h(ctx) {
		let section;
		let div;
		let each_value = ensure_array_like(/*svgPaths*/ ctx[1]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$7(get_each_context$7(ctx, each_value, i));
		}

		return {
			c() {
				section = element("section");
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(div, "class", "icon-section");
				attr(section, "class", "sectionIcon");
				attr(section, "role", "region");
				attr(section, "aria-label", "Icônes de logement");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, div);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*accommodationData, iconTextMap, svgPaths*/ 7) {
					each_value = ensure_array_like(/*svgPaths*/ ctx[1]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$7(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$7(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance$f($$self, $$props, $$invalidate) {
		let { myAccommodation } = $$props;

		let accommodationData = myAccommodation && myAccommodation.length > 0
		? myAccommodation[0]
		: null;

		const { svgPaths } = accommodationData;

		const iconTextMap = {
			1: { property: "capacity", suffix: "Hôtes" },
			2: { property: "rooms", suffix: "Chambre" },
			3: { property: "bathrooms", suffix: "Douche" },
			4: { property: "beds", suffix: "Lits" },
			5: { property: "squareMeter", suffix: "m²" }
		};

		$$self.$$set = $$props => {
			if ('myAccommodation' in $$props) $$invalidate(3, myAccommodation = $$props.myAccommodation);
		};

		return [accommodationData, svgPaths, iconTextMap, myAccommodation];
	}

	class Icon extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$f, create_fragment$h, safe_not_equal, { myAccommodation: 3 });
		}
	}

	/* src/components/Carousel.svelte generated by Svelte v4.2.12 */

	function create_if_block_1$6(ctx) {
		let button;
		let mounted;
		let dispose;

		return {
			c() {
				button = element("button");
				button.textContent = "<";
				attr(button, "class", "prev-button");
				attr(button, "aria-label", "Image Précédente");
			},
			m(target, anchor) {
				insert(target, button, anchor);

				if (!mounted) {
					dispose = [
						listen(button, "click", /*click_handler*/ ctx[7]),
						listen(button, "keydown", /*keydown_handler*/ ctx[8])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (93:12) {#if showButtons}
	function create_if_block$9(ctx) {
		let button;
		let mounted;
		let dispose;

		return {
			c() {
				button = element("button");
				button.textContent = ">";
				attr(button, "class", "next-button");
				attr(button, "aria-label", "Image Suivante");
			},
			m(target, anchor) {
				insert(target, button, anchor);

				if (!mounted) {
					dispose = [
						listen(button, "click", /*click_handler_1*/ ctx[9]),
						listen(button, "keydown", /*keydown_handler_1*/ ctx[10])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$g(ctx) {
		let section;
		let div1;
		let div0;
		let t0;
		let img;
		let img_src_value;
		let t1;
		let mounted;
		let dispose;
		let if_block0 = /*showButtons*/ ctx[1] && create_if_block_1$6(ctx);
		let if_block1 = /*showButtons*/ ctx[1] && create_if_block$9(ctx);

		return {
			c() {
				section = element("section");
				div1 = element("div");
				div0 = element("div");
				if (if_block0) if_block0.c();
				t0 = space();
				img = element("img");
				t1 = space();
				if (if_block1) if_block1.c();
				attr(img, "class", "imageMiniCarousel");
				if (!src_url_equal(img.src, img_src_value = /*imageUrl1*/ ctx[0])) attr(img, "src", img_src_value);
				attr(img, "alt", "Première Image");
				attr(img, "role", "img");
				attr(img, "aria-label", "Première Image");
				attr(img, "aria-describedby", "image-description");
				attr(img, "title", /*title*/ ctx[2]);
				attr(div0, "class", "image-container");
				attr(div0, "tabindex", "0");
				attr(div1, "class", "carousel");
				attr(div1, "role", "button");
				attr(div1, "aria-label", "Carousel");
				attr(div1, "aria-roledescription", "Carousel avec deux images");
				attr(div1, "aria-pressed", "false");
				attr(div1, "tabindex", "0");
				attr(section, "class", "miniCarousel");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, div1);
				append(div1, div0);
				if (if_block0) if_block0.m(div0, null);
				append(div0, t0);
				append(div0, img);
				append(div0, t1);
				if (if_block1) if_block1.m(div0, null);

				if (!mounted) {
					dispose = [
						listen(div0, "keydown", /*keydown_handler_2*/ ctx[11]),
						listen(div1, "mouseenter", /*mouseenter_handler*/ ctx[12]),
						listen(div1, "mouseleave", /*mouseleave_handler*/ ctx[13]),
						listen(div1, "keydown", /*keydown_handler_3*/ ctx[14])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (/*showButtons*/ ctx[1]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1$6(ctx);
						if_block0.c();
						if_block0.m(div0, t0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (dirty & /*imageUrl1*/ 1 && !src_url_equal(img.src, img_src_value = /*imageUrl1*/ ctx[0])) {
					attr(img, "src", img_src_value);
				}

				if (dirty & /*title*/ 4) {
					attr(img, "title", /*title*/ ctx[2]);
				}

				if (/*showButtons*/ ctx[1]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block$9(ctx);
						if_block1.c();
						if_block1.m(div0, null);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$e($$self, $$props, $$invalidate) {
		let { images } = $$props;

		// Initialisation de l'index de l'image actuelle
		let currentIndex = 0;

		// Initialisation des URL des deux images actuelles et suivantes
		let imageUrl1 = images[currentIndex].src;

		images[(currentIndex + 1) % images.length].src;

		// Variable pour contrôler l'affichage des boutons
		let showButtons = false;

		// Interval pour changer d'image automatiquement toutes les 10 secondes
		const interval = setInterval(
			() => {
				currentIndex = (currentIndex + 1) % images.length;
				$$invalidate(0, imageUrl1 = images[currentIndex].src);
				images[(currentIndex + 1) % images.length].src;
			},
			3000
		);

		// Fonction exécutée après le rendu initial du composant
		onMount(() => {
			// Nettoie l'intervalle lorsque le composant est démonté
			return () => clearInterval(interval);
		});

		// Fonction exécutée lorsqu'un composant est démonté
		onDestroy(() => {
			clearInterval(interval);
		});

		// Fonction pour basculer l'affichage des boutons
		function toggleButtons(value) {
			$$invalidate(1, showButtons = value);
		}

		// Fonction pour passer à l'image suivante
		function nextImage() {
			currentIndex = (currentIndex + 1) % images.length;
			$$invalidate(0, imageUrl1 = images[currentIndex].src);
			images[(currentIndex + 1) % images.length].src;

			// Récupération du title associé à l'image actuelle
			$$invalidate(2, title = images[currentIndex].title);
		}

		// Fonction pour revenir à l'image précédente
		function prevImage() {
			currentIndex = (currentIndex - 1 + images.length) % images.length;
			$$invalidate(0, imageUrl1 = images[currentIndex].src);
			images[(currentIndex + 1) % images.length].src;

			// Récupération du title associé à l'image actuelle
			$$invalidate(2, title = images[currentIndex].title);
		}

		let title = images[currentIndex].title;
		const click_handler = () => prevImage();
		const keydown_handler = event => handleButtonKeyDown(event);
		const click_handler_1 = () => nextImage();
		const keydown_handler_1 = event => handleButtonKeyDown(event);
		const keydown_handler_2 = e => handleKeyDown(e);
		const mouseenter_handler = () => toggleButtons(true);
		const mouseleave_handler = () => toggleButtons(false);
		const keydown_handler_3 = event => handleKeyDown(event);

		$$self.$$set = $$props => {
			if ('images' in $$props) $$invalidate(6, images = $$props.images);
		};

		return [
			imageUrl1,
			showButtons,
			title,
			toggleButtons,
			nextImage,
			prevImage,
			images,
			click_handler,
			keydown_handler,
			click_handler_1,
			keydown_handler_1,
			keydown_handler_2,
			mouseenter_handler,
			mouseleave_handler,
			keydown_handler_3
		];
	}

	class Carousel extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$e, create_fragment$g, safe_not_equal, { images: 6 });
		}
	}

	const images$2 = 
	   [
	    {
	      alt: 'Description de l\'image 6',
	      src: 'src/assets/imgHaute/haute.webp',
	      title: 'Titre de l\'image 6'
	    },
	    {
	      alt: 'Description de l\'image 1',
	      src: 'src/assets/imgHaute/haute1.webp',
	      title: 'Titre de l\'image 1'
	    },
	    {
	      alt: 'Description de l\'image 2',
	      src: 'src/assets/imgHaute/haute2.webp',
	      title: 'Titre de l\'image 2'
	    },
	    {
	      alt: 'Description de l\'image 3',
	      src: 'src/assets/imgHaute/haute3.webp',
	      title: 'Titre de l\'image 3'
	    },
	    {
	      alt: 'Description de l\'image 4',
	      src: 'src/assets/imgHaute/haute4.webp',
	      title: 'Titre de l\'image 4'
	    },
	    {
	      alt: 'Description de l\'image 5',
	      src: 'src/assets/imgHaute/haute5.webp',
	      title: 'Titre de l\'image 5'
	    },
	    {
	      alt: 'Description de l\'image 6',
	      src: 'src/assets/imgHaute/haute6.webp',
	      title: 'Titre de l\'image 6'
	    },
	  ];

	const informations$2 = [
	  {
	    name: "Marée Haute",
	    title: "Gite 2 pièces",
	    description:
	      "Découvrez le confort d'une maison ancienne rénovée. <br/><br/> Parfait pour deux personnes, ce logement de 27m2 propose une cuisine équipée, une chambre de 12m2 avec lit king-size et panderie et une salle d'eau. <br/><br/> Profitez d'une terrasse privative et partagez un vaste jardin de 3000 mètres carrés avec des équipements ludiques.",
	    roomComposition: ["1 chambre (1 lit 160x200)"],
	    tarifs: [
	      { label: "À partir de", amount: "51,43 €", isBold: true },
	      { label: "Montant de la caution :", amount: "300,00 €", isBold: true },
	      { label: "Forfait ménage :", amount: "30€ /séjour (en supplément)", isBold: true },
	      { label: "Taxe de séjour", additionalInfo: "(en supplément)" },
	    ],
	  },
	];

	const myAccommodation$2 = [
	  {
	    capacity: 2,
	    rooms: 1,
	    bathrooms: 1,
	    beds: 1,
	    squareMeter: 27,
	    svgPaths: [
	      { id: 1, path: "src/assets/public/guests.svg", title: "Capacity", text: "Hôtes" },
	      { id: 2, path: "src/assets/public/bedrooms.svg", title: "Number of rooms", text: "Chambre" },
	      { id: 3, path: "src/assets/public/shower.svg", title: "Number of bathrooms", text: "Douche " },
	      { id: 4, path: "src/assets/public/beds.svg", title: "Number of beds", text: "Lits" },
	      { id: 5, path: "src/assets/public/area.svg", title: "Surface", text: "m2" },
	    ],
	  },
	];

	const tarifs$2 = informations$2[0].tarifs;
	const combinedData$2 = [...informations$2, ...myAccommodation$2];

	/* src/pages/Haute.svelte generated by Svelte v4.2.12 */

	function get_each_context$6(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[6] = list[i].label;
		child_ctx[7] = list[i].amount;
		child_ctx[8] = list[i].isBold;
		child_ctx[9] = list[i].additionalInfo;
		child_ctx[11] = i;
		return child_ctx;
	}

	function get_each_context_1$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i].id;
		child_ctx[3] = list[i].name;
		child_ctx[13] = list[i].imageSrc;
		return child_ctx;
	}

	function get_each_context_2$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[16] = list[i];
		return child_ctx;
	}

	function get_each_context_3$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[19] = list[i];
		return child_ctx;
	}

	// (128:8) {:else}
	function create_else_block_2(ctx) {
		let p;

		return {
			c() {
				p = element("p");
				p.textContent = "Loading...";
			},
			m(target, anchor) {
				insert(target, p, anchor);
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (126:8) {#if myAccommodation[0]}
	function create_if_block_3$2(ctx) {
		let icon;
		let current;

		icon = new Icon({
				props: { myAccommodation: myAccommodation$2, "aria-hidden": "true" }
			});

		return {
			c() {
				create_component(icon.$$.fragment);
			},
			m(target, anchor) {
				mount_component(icon, target, anchor);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(icon.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(icon.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(icon, detaching);
			}
		};
	}

	// (157:16) {:else}
	function create_else_block_1(ctx) {
		let p;

		return {
			c() {
				p = element("p");
				p.textContent = "Loading...";
			},
			m(target, anchor) {
				insert(target, p, anchor);
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (155:16) {#if myAccommodation[0]}
	function create_if_block_2$2(ctx) {
		let icon;
		let current;

		icon = new Icon({
				props: { myAccommodation: myAccommodation$2, "aria-hidden": "true" }
			});

		return {
			c() {
				create_component(icon.$$.fragment);
			},
			m(target, anchor) {
				mount_component(icon, target, anchor);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(icon.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(icon.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(icon, detaching);
			}
		};
	}

	// (175:16) {#each roomComposition as room (room)}
	function create_each_block_3$2(key_1, ctx) {
		let div;
		let p;
		let t1;

		return {
			key: key_1,
			first: null,
			c() {
				div = element("div");
				p = element("p");
				p.textContent = `${/*room*/ ctx[19]}`;
				t1 = space();
				attr(div, "class", "chambre");
				this.first = div;
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(div, t1);
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (185:20) {#each equipements as equipement (equipement.nom)}
	function create_each_block_2$2(key_1, ctx) {
		let li;
		let img;
		let img_src_value;
		let t0;
		let t1_value = /*equipement*/ ctx[16].nom + "";
		let t1;
		let t2;

		return {
			key: key_1,
			first: null,
			c() {
				li = element("li");
				img = element("img");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				if (!src_url_equal(img.src, img_src_value = /*equipement*/ ctx[16].image)) attr(img, "src", img_src_value);
				attr(img, "alt", /*equipement*/ ctx[16].alt);
				attr(li, "class", "equipement-item");
				this.first = li;
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
				append(li, t2);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (207:12) {#each equipmentOutdoorItems as { id, name, imageSrc }}
	function create_each_block_1$2(ctx) {
		let li;
		let img;
		let img_src_value;
		let img_srcset_value;
		let t0;
		let t1;

		return {
			c() {
				li = element("li");
				img = element("img");
				t0 = text(/*name*/ ctx[3]);
				t1 = space();
				if (!src_url_equal(img.src, img_src_value = /*imageSrc*/ ctx[13])) attr(img, "src", img_src_value);
				attr(img, "alt", /*name*/ ctx[3]);
				if (!srcset_url_equal(img, img_srcset_value = "")) attr(img, "srcset", img_srcset_value);
				attr(li, "class", getClassName$2(/*id*/ ctx[12]));
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (235:16) {:else}
	function create_else_block$4(ctx) {
		let t;

		return {
			c() {
				t = text(/*label*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (233:16) {#if isBold}
	function create_if_block_1$5(ctx) {
		let t0;
		let t1;
		let span;

		return {
			c() {
				t0 = text(/*label*/ ctx[6]);
				t1 = space();
				span = element("span");
				span.textContent = `${/*amount*/ ctx[7]}`;
				attr(span, "class", "tariffAmount");
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(span);
				}
			}
		};
	}

	// (238:16) {#if additionalInfo}
	function create_if_block$8(ctx) {
		let span;

		return {
			c() {
				span = element("span");
				span.textContent = `${/*additionalInfo*/ ctx[9]}`;
				attr(span, "class", "additionalInfo");
			},
			m(target, anchor) {
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (231:8) {#each tarifs as { label, amount, isBold, additionalInfo }
	function create_each_block$6(key_2, ctx) {
		let p;
		let t0;
		let t1;

		function select_block_type_2(ctx, dirty) {
			if (/*isBold*/ ctx[8]) return create_if_block_1$5;
			return create_else_block$4;
		}

		let current_block_type = select_block_type_2(ctx);
		let if_block0 = current_block_type(ctx);
		let if_block1 = /*additionalInfo*/ ctx[9] && create_if_block$8(ctx);

		return {
			key: key_2,
			first: null,
			c() {
				p = element("p");
				if_block0.c();
				t0 = space();
				if (if_block1) if_block1.c();
				t1 = space();
				attr(p, "class", "tariffItem");
				attr(p, "key", /*key*/ ctx[11]);
				this.first = p;
			},
			m(target, anchor) {
				insert(target, p, anchor);
				if_block0.m(p, null);
				append(p, t0);
				if (if_block1) if_block1.m(p, null);
				append(p, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}

				if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function create_fragment$f(ctx) {
		let section1;
		let header;
		let div1;
		let img;
		let img_src_value;
		let t0;
		let div0;
		let t2;
		let nav;
		let a0;
		let t4;
		let a1;
		let t6;
		let a2;
		let t8;
		let a3;
		let t10;
		let section0;
		let current_block_type_index;
		let if_block0;
		let t11;
		let section4;
		let div2;
		let h10;
		let t13;
		let div6;
		let section2;
		let carousel0;
		let t14;
		let div5;
		let h11;
		let t16;
		let section3;
		let current_block_type_index_1;
		let if_block1;
		let t17;
		let p;
		let t18;
		let br;
		let t19;
		let div3;
		let h20;
		let t21;
		let each_blocks_3 = [];
		let each0_lookup = new Map();
		let t22;
		let div4;
		let h21;
		let t24;
		let ul0;
		let each_blocks_2 = [];
		let each1_lookup = new Map();
		let t25;
		let section5;
		let carousel1;
		let t26;
		let section6;
		let div7;
		let h22;
		let t28;
		let ul1;
		let t29;
		let section7;
		let t39;
		let section8;
		let h24;
		let t41;
		let div9;
		let each_blocks = [];
		let each3_lookup = new Map();
		let current;
		let mounted;
		let dispose;
		const if_block_creators = [create_if_block_3$2, create_else_block_2];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (myAccommodation$2[0]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type();
		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
		carousel0 = new Carousel({ props: { images: images$2 } });
		const if_block_creators_1 = [create_if_block_2$2, create_else_block_1];
		const if_blocks_1 = [];

		function select_block_type_1(ctx, dirty) {
			if (myAccommodation$2[0]) return 0;
			return 1;
		}

		current_block_type_index_1 = select_block_type_1();
		if_block1 = if_blocks_1[current_block_type_index_1] = if_block_creators_1[current_block_type_index_1](ctx);
		let each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
		const get_key = ctx => /*room*/ ctx[19];

		for (let i = 0; i < each_value_3.length; i += 1) {
			let child_ctx = get_each_context_3$2(ctx, each_value_3, i);
			let key = get_key(child_ctx);
			each0_lookup.set(key, each_blocks_3[i] = create_each_block_3$2(key, child_ctx));
		}

		let each_value_2 = ensure_array_like(equipementsItems);
		const get_key_1 = ctx => /*equipement*/ ctx[16].nom;

		for (let i = 0; i < each_value_2.length; i += 1) {
			let child_ctx = get_each_context_2$2(ctx, each_value_2, i);
			let key = get_key_1(child_ctx);
			each1_lookup.set(key, each_blocks_2[i] = create_each_block_2$2(key, child_ctx));
		}

		carousel1 = new Carousel({ props: { images: images$2 } });
		let each_value_1 = ensure_array_like(equipmentOutdoorItems);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like(tarifs$2);
		const get_key_2 = ctx => /*key*/ ctx[11];

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$6(ctx, each_value, i);
			let key = get_key_2(child_ctx);
			each3_lookup.set(key, each_blocks[i] = create_each_block$6(key, child_ctx));
		}

		return {
			c() {
				section1 = element("section");
				header = element("header");
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				div0.textContent = `${/*name*/ ctx[3]}`;
				t2 = space();
				nav = element("nav");
				a0 = element("a");
				a0.textContent = "DESCRIPTION";
				t4 = space();
				a1 = element("a");
				a1.textContent = "ÉQUIPEMENT";
				t6 = space();
				a2 = element("a");
				a2.textContent = "SERVICES";
				t8 = space();
				a3 = element("a");
				a3.textContent = "TARIFS";
				t10 = space();
				section0 = element("section");
				if_block0.c();
				t11 = space();
				section4 = element("section");
				div2 = element("div");
				h10 = element("h1");
				h10.textContent = `${/*title*/ ctx[0]}`;
				t13 = space();
				div6 = element("div");
				section2 = element("section");
				create_component(carousel0.$$.fragment);
				t14 = space();
				div5 = element("div");
				h11 = element("h1");
				h11.textContent = `${/*title*/ ctx[0]}`;
				t16 = space();
				section3 = element("section");
				if_block1.c();
				t17 = space();
				p = element("p");
				t18 = space();
				br = element("br");
				t19 = space();
				div3 = element("div");
				h20 = element("h2");
				h20.textContent = "Composition des chambres";
				t21 = space();

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].c();
				}

				t22 = space();
				div4 = element("div");
				h21 = element("h2");
				h21.textContent = "Équipements inclus";
				t24 = space();
				ul0 = element("ul");

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].c();
				}

				t25 = space();
				section5 = element("section");
				create_component(carousel1.$$.fragment);
				t26 = space();
				section6 = element("section");
				div7 = element("div");
				h22 = element("h2");
				h22.textContent = "Équipement extérieur";
				t28 = space();
				ul1 = element("ul");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t29 = space();
				section7 = element("section");
				section7.innerHTML = `<div class="squareService"><h2 class="serviceTitle" id="serviceHeading">Services</h2> <ul class="serviceList"><li aria-label="Animaux gratuits">Animaux gratuits</li> <li aria-label="Linge de maison fourni">Linge de maison fourni</li> <li aria-label="Lits faits à l&#39;arrivée">Lits faits à l&#39;arrivée</li> <li aria-label="Ménage fin de séjour en option*">Ménage fin de séjour en option*</li></ul></div>`;
				t39 = space();
				section8 = element("section");
				h24 = element("h2");
				h24.textContent = "Tarifs";
				t41 = space();
				div9 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(img, "class", "imgHeader");
				if (!src_url_equal(img.src, img_src_value = "src/assets/ImgHaute/haute.webp")) attr(img, "src", img_src_value);
				attr(img, "alt", "");
				attr(div0, "class", "texteImgHeader");
				attr(div1, "class", "containerHeader");
				attr(a0, "href", "#cottageDescription");
				attr(a0, "tabindex", "0");
				attr(a0, "data-section", "cottageDescription");
				attr(a0, "aria-label", "Aller à la section Description du gîte");
				attr(a1, "href", "#equipmentOutdoor");
				attr(a1, "tabindex", "0");
				attr(a1, "data-section", "equipmentOutdoor");
				attr(a1, "aria-label", "Aller à la section Équipement extérieur du gîte");
				attr(a2, "href", "#service");
				attr(a2, "tabindex", "0");
				attr(a2, "data-section", "service");
				attr(a2, "aria-label", "Aller à la section Services du gîte");
				attr(a3, "href", "#tarif");
				attr(a3, "tabindex", "0");
				attr(a3, "data-section", "tarif");
				attr(a3, "aria-label", "Aller à la section Tarifs du gîte");
				attr(nav, "class", "navigationLinks");
				attr(nav, "aria-label", "Sections du gîte");
				attr(section0, "class", "IconMobile");
				attr(section0, "role", "presentation");
				attr(section1, "class", "sectionPageCottage");
				attr(section1, "aria-labelledby", "cottageHeading");
				attr(h10, "class", "descriptionTitle");
				attr(h10, "id", "cottageDescHeading");
				attr(section2, "class", "carouselDesktop");
				attr(h11, "class", "descriptionTitleMobile");
				attr(h11, "id", "cottageDescHeading");
				attr(section3, "class", "iconDesktop");
				attr(section3, "role", "presentation");
				attr(p, "class", "container-text");
				attr(h20, "class", "roomH2");
				attr(h20, "id", "roomCompositionHeading");
				attr(div3, "class", "room-composition");
				attr(div3, "aria-labelledby", "roomCompositionHeading");
				attr(h21, "class", "EquipementH2");
				attr(div4, "class", "equipements");
				attr(div5, "class", "squareDescription");
				attr(div6, "class", "description");
				attr(section4, "id", "cottageDescription");
				attr(section4, "class", "sectionMain");
				attr(section4, "aria-labelledby", "cottageDescHeading");
				attr(section5, "class", "carouselMobile");
				attr(h22, "class", "outdoorH2");
				attr(h22, "id", "equipOutdoorHeading");
				attr(ul1, "class", "equipement-list");
				attr(div7, "class", "outdoor-equipment");
				attr(section6, "id", "equipmentOutdoor");
				attr(section6, "class", "equipment");
				attr(section6, "aria-labelledby", "equipOutdoorHeading");
				attr(section7, "id", "service");
				attr(section7, "class", "sectionService");
				attr(section7, "aria-labelledby", "serviceHeading");
				attr(h24, "class", "ratesTitle");
				attr(h24, "id", "tarifHeading");
				attr(div9, "class", "tariffDetails");
				attr(section8, "id", "tarif");
				attr(section8, "class", "rates");
				attr(section8, "aria-labelledby", "tarifHeading");
			},
			m(target, anchor) {
				insert(target, section1, anchor);
				append(section1, header);
				append(header, div1);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(section1, t2);
				append(section1, nav);
				append(nav, a0);
				append(nav, t4);
				append(nav, a1);
				append(nav, t6);
				append(nav, a2);
				append(nav, t8);
				append(nav, a3);
				append(section1, t10);
				append(section1, section0);
				if_blocks[current_block_type_index].m(section0, null);
				insert(target, t11, anchor);
				insert(target, section4, anchor);
				append(section4, div2);
				append(div2, h10);
				append(section4, t13);
				append(section4, div6);
				append(div6, section2);
				mount_component(carousel0, section2, null);
				append(div6, t14);
				append(div6, div5);
				append(div5, h11);
				append(div5, t16);
				append(div5, section3);
				if_blocks_1[current_block_type_index_1].m(section3, null);
				append(div5, t17);
				append(div5, p);
				p.innerHTML = /*description*/ ctx[1];
				append(div5, t18);
				append(div5, br);
				append(div5, t19);
				append(div5, div3);
				append(div3, h20);
				append(div3, t21);

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					if (each_blocks_3[i]) {
						each_blocks_3[i].m(div3, null);
					}
				}

				append(div5, t22);
				append(div5, div4);
				append(div4, h21);
				append(div4, t24);
				append(div4, ul0);

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					if (each_blocks_2[i]) {
						each_blocks_2[i].m(ul0, null);
					}
				}

				insert(target, t25, anchor);
				insert(target, section5, anchor);
				mount_component(carousel1, section5, null);
				insert(target, t26, anchor);
				insert(target, section6, anchor);
				append(section6, div7);
				append(div7, h22);
				append(div7, t28);
				append(div7, ul1);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(ul1, null);
					}
				}

				insert(target, t29, anchor);
				insert(target, section7, anchor);
				insert(target, t39, anchor);
				insert(target, section8, anchor);
				append(section8, h24);
				append(section8, t41);
				append(section8, div9);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div9, null);
					}
				}

				current = true;

				if (!mounted) {
					dispose = [
						listen(a0, "click", scrollToSection$2),
						listen(a0, "keydown", handleKeyDown$3),
						listen(a1, "click", scrollToSection$2),
						listen(a1, "keydown", handleKeyDown$3),
						listen(a2, "click", scrollToSection$2),
						listen(a2, "keydown", handleKeyDown$3),
						listen(a3, "click", scrollToSection$2),
						listen(a3, "keydown", handleKeyDown$3)
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*roomComposition*/ 4) {
					each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
					each_blocks_3 = update_keyed_each(each_blocks_3, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div3, destroy_block, create_each_block_3$2, null, get_each_context_3$2);
				}

				if (dirty & /*getClassName*/ 0) {
					each_value_1 = ensure_array_like(equipmentOutdoorItems);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1$2(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1$2(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(ul1, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(carousel0.$$.fragment, local);
				transition_in(if_block1);
				transition_in(carousel1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(if_block0);
				transition_out(carousel0.$$.fragment, local);
				transition_out(if_block1);
				transition_out(carousel1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(section1);
					detach(t11);
					detach(section4);
					detach(t25);
					detach(section5);
					detach(t26);
					detach(section6);
					detach(t29);
					detach(section7);
					detach(t39);
					detach(section8);
				}

				if_blocks[current_block_type_index].d();
				destroy_component(carousel0);
				if_blocks_1[current_block_type_index_1].d();

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].d();
				}

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].d();
				}

				destroy_component(carousel1);
				destroy_each(each_blocks_1, detaching);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function getClassName$2(id) {
		return `iconEquipement ${id === 1
	? "barbecue"
	: id === 2
		? "private-parking"
		: id === 3
			? "shared-garden"
			: id === 4
				? "lounger-chair"
				: id === 5
					? "patio-furniture"
					: id === 6 ? "private-terrace" : ""}`;
	}

	function scrollToSection$2(event) {
		event.preventDefault();
		const sectionId = event.currentTarget.dataset.section;
		console.log("Section ID:", sectionId);
		const section = document.getElementById(sectionId);

		if (section) {
			section.scrollIntoView({ behavior: "smooth" });
		}
	}

	function handleKeyDown$3(event) {
		if (event.key === "Enter") {
			const sectionId = event.currentTarget.dataset.section;
			const section = document.getElementById(sectionId);

			if (section) {
				section.scrollIntoView({ behavior: "smooth" });
			}
		}
	}

	function instance$d($$self) {
		const cottage = combinedData$2.find(item => item.title === "Gite 2 pièces");
		console.log(cottage);
		let { name, title, description, roomComposition } = cottage;
		return [title, description, roomComposition, name];
	}

	class Haute extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$d, create_fragment$f, safe_not_equal, {});
		}
	}

	/* src/pages/Info.svelte generated by Svelte v4.2.12 */

	function create_fragment$e(ctx) {
		let div4;

		return {
			c() {
				div4 = element("div");

				div4.innerHTML = `<div class="custom-header svelte-ij0u6k"><h1>Itinéraire vers notre gîte</h1></div> <div class="custom-main svelte-ij0u6k"><div class="instructions svelte-ij0u6k"><h2 class="svelte-ij0u6k">Comment venir depuis les principales villes :</h2> <ul><li><strong>Depuis Paris :</strong> Prenez l&#39;autoroute A11 en direction
                    de Nantes...</li> <li><strong>Depuis Nantes :</strong> Prenez l&#39;A83 en direction de
                    La Roche-sur-Yon...</li> <li><strong>Depuis Bordeaux :</strong> Prenez l&#39;A10 en direction
                    de Poitiers...</li></ul></div> <iframe src="https://www.google.com/maps/d/embed?mid=1f3EkxUy4VLsVmHgcalpX69A2EFahOGA&amp;ehbc=2E312F&amp;noprof=1" width="100%" height="380" title="Google map"></iframe></div> <div class="text_footer svelte-ij0u6k"><p class="svelte-ij0u6k">Nous sommes impatients de vous accueillir dans notre gîte à
            Saint-Vincent-sur-Jard ! Si vous avez besoin de plus d&#39;informations
            ou d&#39;assistance pour trouver notre emplacement, n&#39;hésitez pas à nous
            contacter.</p></div>`;

				attr(div4, "class", "container svelte-ij0u6k");
			},
			m(target, anchor) {
				insert(target, div4, anchor);
			},
			p: noop,
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div4);
				}
			}
		};
	}

	class Info extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$e, safe_not_equal, {});
		}
	}

	const images$1 = 
	   [
	    {
	      alt: 'Description de l\'image 1',
	      src: 'src/assets/imgEtale/etale1.png',
	      title: 'Titre de l\'image 1'
	    },
	    {
	      alt: 'Description de l\'image 2',
	      src: 'src/assets/imgEtale/etale2.png',
	      title: 'Titre de l\'image 2'
	    },
	    {
	      alt: 'Description de l\'image 3',
	      src: 'src/assets/imgEtale/etale3.png',
	      title: 'Titre de l\'image 3'
	    },
	    {
	      alt: 'Description de l\'image 4',
	      src: 'src/assets/imgEtale/etale4.png',
	      title: 'Titre de l\'image 4'
	    },
	    {
	      alt: 'Description de l\'image 5',
	      src: 'src/assets/imgEtale/etale5.png',
	      title: 'Titre de l\'image 5'
	    },
	    {
	      alt: 'Description de l\'image 6',
	      src: 'src/assets/imgEtale/etale6.png',
	      title: 'Titre de l\'image 6'
	    },
	    {
	      alt: 'Description de l\'image 7',
	      src: 'src/assets/imgEtale/etale7.png',
	      title: 'Titre de l\'image 7'
	    },
	    {
	      alt: 'Description de l\'image 8',
	      src: 'src/assets/imgEtale/etale8.png',
	      title: 'Titre de l\'image 8'
	    },
	    {
	      alt: 'Description de l\'image 9',
	      src: 'src/assets/imgEtale/etale9.png',
	      title: 'Titre de l\'image 9'
	    },
	    {
	      alt: 'Description de l\'image 10',
	      src: 'src/assets/imgEtale/etale10.png',
	      title: 'Titre de l\'image 10'
	    },
	    {
	      alt: 'Description de l\'image 11',
	      src: 'src/assets/imgEtale/etale11.png',
	      title: 'Titre de l\'image 11'
	    },
	    {
	      alt: 'Description de l\'image 12',
	      src: 'src/assets/imgEtale/etale12.png',
	      title: 'Titre de l\'image 12'
	    },
	    {
	      alt: 'Description de l\'image 13',
	      src: 'src/assets/imgEtale/etale13.png',
	      title: 'Titre de l\'image 13'
	    },
	    {
	      alt: 'Description de l\'image 14',
	      src: 'src/assets/imgEtale/etale1.png',
	      title: 'Titre de l\'image 14'
	    },
	    // ... Ajoutez d'autres objets d'image avec leurs propriétés
	  ];

	// InformationEtale.js

	const informations$1 = [
	    {
	      name:"Étale",
	      title: "Gite 3 pièces",
	      description: "Gite de 100m2 rénovée, située au rez-de-chaussée, au-dessus de la maison des propriétaires, sur un terrain de 300m2 comprenant 2 autres gîtes. <br/><br/> Accès commun au logement avec un parking privatif. salon (cheminée décorative)/séjour/cuisine ouverte. <br/><br/> une terrasse privative, soigneusement aménagée avec un salon de jardin, offrant un espace extérieur.",
	      roomComposition: [
	        "1 lit 160x200",
	        "2 lits jumelables 80x200",
	        "1 lit 180x200",
	      ],
	      tarifs: [
	        { label: "À partir de", amount: "101,67 €", isBold: true },
	        { label: "Montant de la caution :", amount: "500,00 €", isBold: true },
	        { label: "Forfait ménage :", amount: "60€ /séjour (en supplément)", isBold: true },
	        { label: "Taxe de séjour", additionalInfo: "(en supplément)" }
	      ],
	    },
	  ];
	  
	  const myAccommodation$1 = [{
	    capacity: 6,
	    rooms: 3,
	    bathrooms: 1,
	    beds: 5,
	    squareMeter: 100,
	    svgPaths: [
	      { id: 1, path: "src/assets/public/guests.svg", title: "Capacity", text: "Hôtes" },
	      { id: 2, path: "src/assets/public/shower.svg", title: "Number of rooms", text: "Douche " },
	      { id: 3, path: "src/assets/public/bedrooms.svg", title: "Number of bathrooms", text: "Chambre" },
	      { id: 4, path: "src/assets/public/beds.svg", title: "Number of beds", text: "Lits"},
	      { id: 5, path: "src/assets/public/area.svg", title: "Surface", text: "m2" }
	    ],
	  },
	];
	  
	  const tarifs$1 = informations$1[0].tarifs;
	  const combinedData$1 = [...informations$1, ...myAccommodation$1];

	/* src/pages/Etale.svelte generated by Svelte v4.2.12 */

	function get_each_context$5(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[6] = list[i].label;
		child_ctx[7] = list[i].amount;
		child_ctx[8] = list[i].isBold;
		child_ctx[9] = list[i].additionalInfo;
		child_ctx[11] = i;
		return child_ctx;
	}

	function get_each_context_1$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i].id;
		child_ctx[3] = list[i].name;
		child_ctx[13] = list[i].imageSrc;
		return child_ctx;
	}

	function get_each_context_2$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[16] = list[i];
		return child_ctx;
	}

	function get_each_context_3$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[19] = list[i];
		return child_ctx;
	}

	// (164:16) {#each roomComposition as room (room)}
	function create_each_block_3$1(key_1, ctx) {
		let div;
		let p;
		let t1;

		return {
			key: key_1,
			first: null,
			c() {
				div = element("div");
				p = element("p");
				p.textContent = `${/*room*/ ctx[19]}`;
				t1 = space();
				attr(div, "class", "chambre");
				this.first = div;
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(div, t1);
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (174:20) {#each equipements as equipement (equipement.nom)}
	function create_each_block_2$1(key_1, ctx) {
		let li;
		let img;
		let img_src_value;
		let t0;
		let t1_value = /*equipement*/ ctx[16].nom + "";
		let t1;
		let t2;

		return {
			key: key_1,
			first: null,
			c() {
				li = element("li");
				img = element("img");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				attr(img, "class", "equipements-img");
				if (!src_url_equal(img.src, img_src_value = /*equipement*/ ctx[16].image)) attr(img, "src", img_src_value);
				attr(img, "alt", /*equipement*/ ctx[16].alt);
				attr(li, "class", "equipement-item");
				this.first = li;
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
				append(li, t2);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (197:12) {#each equipmentOutdoorItems as { id, name, imageSrc }}
	function create_each_block_1$1(ctx) {
		let li;
		let img;
		let img_src_value;
		let img_srcset_value;
		let t0;
		let t1;

		return {
			c() {
				li = element("li");
				img = element("img");
				t0 = text(/*name*/ ctx[3]);
				t1 = space();
				if (!src_url_equal(img.src, img_src_value = /*imageSrc*/ ctx[13])) attr(img, "src", img_src_value);
				attr(img, "alt", /*name*/ ctx[3]);
				if (!srcset_url_equal(img, img_srcset_value = "")) attr(img, "srcset", img_srcset_value);
				attr(li, "class", getClassName$1(/*id*/ ctx[12]));
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (226:10) {:else}
	function create_else_block$3(ctx) {
		let t;

		return {
			c() {
				t = text(/*label*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (224:10) {#if isBold}
	function create_if_block_1$4(ctx) {
		let t0;
		let t1;
		let span;

		return {
			c() {
				t0 = text(/*label*/ ctx[6]);
				t1 = space();
				span = element("span");
				span.textContent = `${/*amount*/ ctx[7]}`;
				attr(span, "class", "tariffAmount");
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(span);
				}
			}
		};
	}

	// (229:10) {#if additionalInfo}
	function create_if_block$7(ctx) {
		let span;

		return {
			c() {
				span = element("span");
				span.textContent = `${/*additionalInfo*/ ctx[9]}`;
				attr(span, "class", "additionalInfo");
			},
			m(target, anchor) {
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (222:6) {#each tarifs as { label, amount, isBold, additionalInfo }
	function create_each_block$5(key_2, ctx) {
		let p;
		let t0;
		let t1;

		function select_block_type(ctx, dirty) {
			if (/*isBold*/ ctx[8]) return create_if_block_1$4;
			return create_else_block$3;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);
		let if_block1 = /*additionalInfo*/ ctx[9] && create_if_block$7(ctx);

		return {
			key: key_2,
			first: null,
			c() {
				p = element("p");
				if_block0.c();
				t0 = space();
				if (if_block1) if_block1.c();
				t1 = space();
				attr(p, "class", "tariffItem");
				attr(p, "key", /*key*/ ctx[11]);
				this.first = p;
			},
			m(target, anchor) {
				insert(target, p, anchor);
				if_block0.m(p, null);
				append(p, t0);
				if (if_block1) if_block1.m(p, null);
				append(p, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}

				if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function create_fragment$d(ctx) {
		let section1;
		let header;
		let div1;
		let img;
		let img_src_value;
		let t0;
		let div0;
		let t2;
		let nav;
		let a0;
		let t4;
		let a1;
		let t6;
		let a2;
		let t8;
		let a3;
		let t10;
		let section0;
		let icon0;
		let t11;
		let section4;
		let div2;
		let h10;
		let t13;
		let div6;
		let section2;
		let carousel0;
		let t14;
		let div5;
		let h11;
		let t16;
		let section3;
		let icon1;
		let t17;
		let p;
		let t18;
		let br;
		let t19;
		let div3;
		let h20;
		let t21;
		let each_blocks_3 = [];
		let each0_lookup = new Map();
		let t22;
		let div4;
		let h21;
		let t24;
		let ul0;
		let each_blocks_2 = [];
		let each1_lookup = new Map();
		let t25;
		let section5;
		let carousel1;
		let t26;
		let section6;
		let div7;
		let h22;
		let t28;
		let ul1;
		let t29;
		let section7;
		let t39;
		let section8;
		let h24;
		let t41;
		let div9;
		let each_blocks = [];
		let each3_lookup = new Map();
		let current;
		let mounted;
		let dispose;

		icon0 = new Icon({
				props: { myAccommodation: myAccommodation$1, "aria-hidden": "true" }
			});

		carousel0 = new Carousel({ props: { images: images$1 } });
		icon1 = new Icon({ props: { myAccommodation: myAccommodation$1 } });
		let each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
		const get_key = ctx => /*room*/ ctx[19];

		for (let i = 0; i < each_value_3.length; i += 1) {
			let child_ctx = get_each_context_3$1(ctx, each_value_3, i);
			let key = get_key(child_ctx);
			each0_lookup.set(key, each_blocks_3[i] = create_each_block_3$1(key, child_ctx));
		}

		let each_value_2 = ensure_array_like(equipementsItems);
		const get_key_1 = ctx => /*equipement*/ ctx[16].nom;

		for (let i = 0; i < each_value_2.length; i += 1) {
			let child_ctx = get_each_context_2$1(ctx, each_value_2, i);
			let key = get_key_1(child_ctx);
			each1_lookup.set(key, each_blocks_2[i] = create_each_block_2$1(key, child_ctx));
		}

		carousel1 = new Carousel({ props: { images: images$1 } });
		let each_value_1 = ensure_array_like(equipmentOutdoorItems);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like(tarifs$1);
		const get_key_2 = ctx => /*key*/ ctx[11];

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$5(ctx, each_value, i);
			let key = get_key_2(child_ctx);
			each3_lookup.set(key, each_blocks[i] = create_each_block$5(key, child_ctx));
		}

		return {
			c() {
				section1 = element("section");
				header = element("header");
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				div0.textContent = `${/*name*/ ctx[3]}`;
				t2 = space();
				nav = element("nav");
				a0 = element("a");
				a0.textContent = "DESCRIPTION";
				t4 = space();
				a1 = element("a");
				a1.textContent = "ÉQUIPEMENT";
				t6 = space();
				a2 = element("a");
				a2.textContent = "SERVICES";
				t8 = space();
				a3 = element("a");
				a3.textContent = "TARIFS";
				t10 = space();
				section0 = element("section");
				create_component(icon0.$$.fragment);
				t11 = space();
				section4 = element("section");
				div2 = element("div");
				h10 = element("h1");
				h10.textContent = `${/*title*/ ctx[0]}`;
				t13 = space();
				div6 = element("div");
				section2 = element("section");
				create_component(carousel0.$$.fragment);
				t14 = space();
				div5 = element("div");
				h11 = element("h1");
				h11.textContent = `${/*title*/ ctx[0]}`;
				t16 = space();
				section3 = element("section");
				create_component(icon1.$$.fragment);
				t17 = space();
				p = element("p");
				t18 = space();
				br = element("br");
				t19 = space();
				div3 = element("div");
				h20 = element("h2");
				h20.textContent = "Composition des chambres";
				t21 = space();

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].c();
				}

				t22 = space();
				div4 = element("div");
				h21 = element("h2");
				h21.textContent = "Équipements inclus";
				t24 = space();
				ul0 = element("ul");

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].c();
				}

				t25 = space();
				section5 = element("section");
				create_component(carousel1.$$.fragment);
				t26 = space();
				section6 = element("section");
				div7 = element("div");
				h22 = element("h2");
				h22.textContent = "Équipement extérieur";
				t28 = space();
				ul1 = element("ul");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t29 = space();
				section7 = element("section");
				section7.innerHTML = `<div class="squareService"><h2 class="serviceTitle" id="serviceHeading">Services</h2> <ul class="serviceList"><li aria-label="Animaux gratuits">Animaux gratuits</li> <li aria-label="Linge de maison fourni">Linge de maison fourni</li> <li aria-label="Lits faits à l&#39;arrivée">Lits faits à l&#39;arrivée</li> <li aria-label="Ménage fin de séjour en option*">Ménage fin de séjour en option*</li></ul></div>`;
				t39 = space();
				section8 = element("section");
				h24 = element("h2");
				h24.textContent = "Tarifs";
				t41 = space();
				div9 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(img, "class", "imgHeader");
				if (!src_url_equal(img.src, img_src_value = "src/assets/ImgEtale/etale1.png")) attr(img, "src", img_src_value);
				attr(img, "alt", "");
				attr(div0, "class", "texteImgHeader");
				attr(div1, "class", "containerHeader");
				attr(a0, "href", "#cottageDescription");
				attr(a0, "tabindex", "0");
				attr(a0, "data-section", "cottageDescription");
				attr(a0, "aria-label", "Aller à la section Description du gîte");
				attr(a1, "href", "#equipmentOutdoor");
				attr(a1, "tabindex", "0");
				attr(a1, "data-section", "equipmentOutdoor");
				attr(a1, "aria-label", "Aller à la section Équipement extérieur du gîte");
				attr(a2, "href", "#service");
				attr(a2, "tabindex", "0");
				attr(a2, "data-section", "service");
				attr(a2, "aria-label", "Aller à la section Services du gîte");
				attr(a3, "href", "#tarif");
				attr(a3, "tabindex", "0");
				attr(a3, "data-section", "tarif");
				attr(a3, "aria-label", "Aller à la section Tarifs du gîte");
				attr(nav, "class", "navigationLinks");
				attr(nav, "aria-label", "Sections du gîte");
				attr(section0, "class", "IconMobile");
				attr(section0, "role", "presentation");
				attr(section1, "class", "sectionPageCottage");
				attr(section1, "aria-labelledby", "cottageHeading");
				attr(h10, "class", "descriptionTitle");
				attr(h10, "id", "cottageDescHeading");
				attr(section2, "class", "carouselDesktop");
				attr(h11, "class", "descriptionTitleMobile");
				attr(h11, "id", "cottageDescHeading");
				attr(section3, "class", "iconDesktop");
				attr(section3, "role", "presentation");
				attr(p, "class", "container-text");
				attr(h20, "class", "roomH2");
				attr(h20, "id", "roomCompositionHeading");
				attr(div3, "class", "room-composition");
				attr(div3, "aria-labelledby", "roomCompositionHeading");
				attr(h21, "class", "equipementH2");
				attr(div4, "class", "equipements");
				attr(div5, "class", "squareDescription");
				attr(div6, "class", "description");
				attr(section4, "id", "cottageDescription");
				attr(section4, "class", "sectionMain");
				attr(section4, "aria-labelledby", "cottageDescHeading");
				attr(section5, "class", "carouselMobile");
				attr(h22, "class", "outdoorH2");
				attr(h22, "id", "equipOutdoorHeading");
				attr(h22, "aria-label", "Équipement extérieur");
				attr(ul1, "class", "equipement-list");
				attr(div7, "class", "outdoor-equipment");
				attr(section6, "id", "equipmentOutdoor");
				attr(section6, "class", "equipment");
				attr(section6, "aria-labelledby", "equipeOutdoorHeading");
				attr(section7, "id", "service");
				attr(section7, "class", "sectionService");
				attr(section7, "aria-labelledby", "serviceHeading");
				attr(h24, "class", "ratesTitle");
				attr(h24, "id", "tarifHeading");
				attr(div9, "class", "tariffDetails");
				attr(section8, "id", "tarif");
				attr(section8, "class", "rates");
				attr(section8, "aria-labelledby", "tarifHeading");
			},
			m(target, anchor) {
				insert(target, section1, anchor);
				append(section1, header);
				append(header, div1);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(section1, t2);
				append(section1, nav);
				append(nav, a0);
				append(nav, t4);
				append(nav, a1);
				append(nav, t6);
				append(nav, a2);
				append(nav, t8);
				append(nav, a3);
				append(section1, t10);
				append(section1, section0);
				mount_component(icon0, section0, null);
				insert(target, t11, anchor);
				insert(target, section4, anchor);
				append(section4, div2);
				append(div2, h10);
				append(section4, t13);
				append(section4, div6);
				append(div6, section2);
				mount_component(carousel0, section2, null);
				append(div6, t14);
				append(div6, div5);
				append(div5, h11);
				append(div5, t16);
				append(div5, section3);
				mount_component(icon1, section3, null);
				append(div5, t17);
				append(div5, p);
				p.innerHTML = /*description*/ ctx[1];
				append(div5, t18);
				append(div5, br);
				append(div5, t19);
				append(div5, div3);
				append(div3, h20);
				append(div3, t21);

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					if (each_blocks_3[i]) {
						each_blocks_3[i].m(div3, null);
					}
				}

				append(div5, t22);
				append(div5, div4);
				append(div4, h21);
				append(div4, t24);
				append(div4, ul0);

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					if (each_blocks_2[i]) {
						each_blocks_2[i].m(ul0, null);
					}
				}

				insert(target, t25, anchor);
				insert(target, section5, anchor);
				mount_component(carousel1, section5, null);
				insert(target, t26, anchor);
				insert(target, section6, anchor);
				append(section6, div7);
				append(div7, h22);
				append(div7, t28);
				append(div7, ul1);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(ul1, null);
					}
				}

				insert(target, t29, anchor);
				insert(target, section7, anchor);
				insert(target, t39, anchor);
				insert(target, section8, anchor);
				append(section8, h24);
				append(section8, t41);
				append(section8, div9);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div9, null);
					}
				}

				current = true;

				if (!mounted) {
					dispose = [
						listen(a0, "click", scrollToSection$1),
						listen(a0, "keydown", handleKeyDown$2),
						listen(a1, "click", scrollToSection$1),
						listen(a1, "keydown", handleKeyDown$2),
						listen(a2, "click", scrollToSection$1),
						listen(a2, "keydown", handleKeyDown$2),
						listen(a3, "click", scrollToSection$1),
						listen(a3, "keydown", handleKeyDown$2)
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*roomComposition*/ 4) {
					each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
					each_blocks_3 = update_keyed_each(each_blocks_3, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div3, destroy_block, create_each_block_3$1, null, get_each_context_3$1);
				}

				if (dirty & /*getClassName*/ 0) {
					each_value_1 = ensure_array_like(equipmentOutdoorItems);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1$1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(ul1, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}
			},
			i(local) {
				if (current) return;
				transition_in(icon0.$$.fragment, local);
				transition_in(carousel0.$$.fragment, local);
				transition_in(icon1.$$.fragment, local);
				transition_in(carousel1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(icon0.$$.fragment, local);
				transition_out(carousel0.$$.fragment, local);
				transition_out(icon1.$$.fragment, local);
				transition_out(carousel1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(section1);
					detach(t11);
					detach(section4);
					detach(t25);
					detach(section5);
					detach(t26);
					detach(section6);
					detach(t29);
					detach(section7);
					detach(t39);
					detach(section8);
				}

				destroy_component(icon0);
				destroy_component(carousel0);
				destroy_component(icon1);

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].d();
				}

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].d();
				}

				destroy_component(carousel1);
				destroy_each(each_blocks_1, detaching);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function getClassName$1(id) {
		return `iconEquipement ${id === 1
	? "barbecue"
	: id === 2
		? "private-parking"
		: id === 3
			? "shared-garden"
			: id === 4
				? "lounger-chair"
				: id === 5
					? "patio-furniture"
					: id === 6 ? "private-terrace" : ""}`;
	}

	function scrollToSection$1(event) {
		event.preventDefault();
		const sectionId = event.currentTarget.dataset.section;
		console.log("Section ID:", sectionId);
		const section = document.getElementById(sectionId);

		if (section) {
			section.scrollIntoView({ behavior: "smooth" });
		}
	}

	function handleKeyDown$2(event) {
		if (event.key === "Enter") {
			const sectionId = event.currentTarget.dataset.section;
			const section = document.getElementById(sectionId);

			if (section) {
				section.scrollIntoView({ behavior: "smooth" });
			}
		}
	}

	function instance$c($$self) {
		const cottage = combinedData$1.find(item => item.title === "Gite 3 pièces");
		let { name, title, description, roomComposition } = cottage;
		return [title, description, roomComposition, name];
	}

	class Etale extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$c, create_fragment$d, safe_not_equal, {});
		}
	}

	const images = 
	   [
	    {
	      alt: 'Description de l\'image 1',
	      src: 'src/assets/imgBasse/basse1.png',
	      title: 'Titre de l\'image 1'
	    },
	    {
	      alt: 'Description de l\'image 2',
	      src: 'src/assets/imgBasse/basse2.png',
	      title: 'Titre de l\'image 2'
	    },
	    {
	      alt: 'Description de l\'image 3',
	      src: 'src/assets/imgBasse/basse3.png',
	      title: 'Titre de l\'image 3'
	    },
	    {
	      alt: 'Description de l\'image 4',
	      src: 'src/assets/imgBasse/basse4.png',
	      title: 'Titre de l\'image 4'
	    },
	    {
	      alt: 'Description de l\'image 5',
	      src: 'src/assets/imgBasse/basse5.png',
	      title: 'Titre de l\'image 5'
	    },
	    {
	      alt: 'Description de l\'image 6',
	      src: 'src/assets/imgBasse/basse6.png',
	      title: 'Titre de l\'image 6'
	    },
	    {
	      alt: 'Description de l\'image 7',
	      src: 'src/assets/imgBasse/basse7.png',
	      title: 'Titre de l\'image 7'
	    },
	    {
	      alt: 'Description de l\'image 8',
	      src: 'src/assets/imgBasse/basse8.png',
	      title: 'Titre de l\'image 8'
	    },
	    {
	      alt: 'Description de l\'image 9',
	      src: 'src/assets/imgBasse/basse9.png',
	      title: 'Titre de l\'image 9'
	    },
	    {
	      alt: 'Description de l\'image 9',
	      src: 'src/assets/imgBasse/basse10.png',
	      title: 'Titre de l\'image 9'
	    },
	    // ... Ajoutez d'autres objets d'image avec leurs propriétés
	  ];

	const informations = [
	  {
	    name: "Marée Basse",
	    title: "Gîte 1 pièce",
	    description: "Gîte rénové, capacité 4 personnes, de 37 m2. Salon, cuisine, 1 chambre (1 lit 160, 1 lit superposé 90), salle d'eau, parking. Terrasse privée, jardin partagé.<br/> <br>  Plage Clemenceau à 1,3 km.<br/> <br>  Commerces estivaux à 250 m. Inclus : chauffage, draps, linge de toilette. Proche forêt, sentiers de randonnées < 2 km.",
	    roomComposition: [
	      "1 lit 160x200",
	      "1 lit superposé (2 x 90x200)"
	    ],
	    tarifs: [
	      { label: "À partir de", amount: "60,00 €", isBold: true },
	      { label: "Montant de la caution :", amount: "350,00 €", isBold: true },
	      { label: "Forfait ménage :", amount: "40€ /séjour (en supplément)", isBold: true },
	      { label: "Taxe de séjour", additionalInfo: "(en supplément)" }
	    ],
	  },
	  // Ajoutez d'autres objets pour chaque description de logement
	];

	const myAccommodation = [{
	  capacity: 4,
	  rooms: 1,
	  bathrooms: 1,
	  beds: 2,
	  squareMeter: 37,
	  svgPaths: [
	    { id: 1, path: "src/assets/public/guests.svg", title: "Capacity", text: "Hôtes" },
	    { id: 2, path: "src/assets/public/bedrooms.svg", title: "Number of rooms", text: "Chambre" },
	    { id: 3, path: "src/assets/public/shower.svg", title: "Number of bathrooms", text: "Douche " },
	    { id: 4, path: "src/assets/public/beds.svg", title: "Number of beds", text: "Lits" },
	    { id: 5, path: "src/assets/public/area.svg", title: "Surface", text: "m2" }
	  ],
	},
	];
	const tarifs = informations[0].tarifs;
	const combinedData = [...informations, ...myAccommodation];

	/* src/pages/Basse.svelte generated by Svelte v4.2.12 */

	function get_each_context$4(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[6] = list[i].label;
		child_ctx[7] = list[i].amount;
		child_ctx[8] = list[i].isBold;
		child_ctx[9] = list[i].additionalInfo;
		child_ctx[11] = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[12] = list[i].id;
		child_ctx[3] = list[i].name;
		child_ctx[13] = list[i].imageSrc;
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[16] = list[i];
		return child_ctx;
	}

	function get_each_context_3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[19] = list[i];
		return child_ctx;
	}

	// (167:16) {#each roomComposition as room (room)}
	function create_each_block_3(key_1, ctx) {
		let div;
		let p;
		let t1;

		return {
			key: key_1,
			first: null,
			c() {
				div = element("div");
				p = element("p");
				p.textContent = `${/*room*/ ctx[19]}`;
				t1 = space();
				attr(div, "class", "chambre");
				this.first = div;
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(div, t1);
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (177:20) {#each equipements as equipement (equipement.nom)}
	function create_each_block_2(key_1, ctx) {
		let li;
		let img;
		let img_src_value;
		let t0;
		let t1_value = /*equipement*/ ctx[16].nom + "";
		let t1;
		let t2;

		return {
			key: key_1,
			first: null,
			c() {
				li = element("li");
				img = element("img");
				t0 = space();
				t1 = text(t1_value);
				t2 = space();
				if (!src_url_equal(img.src, img_src_value = /*equipement*/ ctx[16].image)) attr(img, "src", img_src_value);
				attr(img, "alt", /*equipement*/ ctx[16].alt);
				attr(li, "class", "equipement-item");
				this.first = li;
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
				append(li, t2);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (199:12) {#each equipmentOutdoorItems as { id, name, imageSrc }}
	function create_each_block_1(ctx) {
		let li;
		let img;
		let img_src_value;
		let img_srcset_value;
		let t0;
		let t1;

		return {
			c() {
				li = element("li");
				img = element("img");
				t0 = text(/*name*/ ctx[3]);
				t1 = space();
				if (!src_url_equal(img.src, img_src_value = /*imageSrc*/ ctx[13])) attr(img, "src", img_src_value);
				attr(img, "alt", /*name*/ ctx[3]);
				if (!srcset_url_equal(img, img_srcset_value = "")) attr(img, "srcset", img_srcset_value);
				attr(li, "class", getClassName(/*id*/ ctx[12]));
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, img);
				append(li, t0);
				append(li, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(li);
				}
			}
		};
	}

	// (227:10) {:else}
	function create_else_block$2(ctx) {
		let t;

		return {
			c() {
				t = text(/*label*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (225:10) {#if isBold}
	function create_if_block_1$3(ctx) {
		let t0;
		let t1;
		let span;

		return {
			c() {
				t0 = text(/*label*/ ctx[6]);
				t1 = space();
				span = element("span");
				span.textContent = `${/*amount*/ ctx[7]}`;
				attr(span, "class", "tariffAmount");
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(span);
				}
			}
		};
	}

	// (230:10) {#if additionalInfo}
	function create_if_block$6(ctx) {
		let span;

		return {
			c() {
				span = element("span");
				span.textContent = `${/*additionalInfo*/ ctx[9]}`;
				attr(span, "class", "additionalInfo");
			},
			m(target, anchor) {
				insert(target, span, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (223:6) {#each tarifs as { label, amount, isBold, additionalInfo }
	function create_each_block$4(key_2, ctx) {
		let p;
		let t0;
		let t1;

		function select_block_type(ctx, dirty) {
			if (/*isBold*/ ctx[8]) return create_if_block_1$3;
			return create_else_block$2;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);
		let if_block1 = /*additionalInfo*/ ctx[9] && create_if_block$6(ctx);

		return {
			key: key_2,
			first: null,
			c() {
				p = element("p");
				if_block0.c();
				t0 = space();
				if (if_block1) if_block1.c();
				t1 = space();
				attr(p, "class", "tariffItem");
				attr(p, "key", /*key*/ ctx[11]);
				this.first = p;
			},
			m(target, anchor) {
				insert(target, p, anchor);
				if_block0.m(p, null);
				append(p, t0);
				if (if_block1) if_block1.m(p, null);
				append(p, t1);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}

				if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function create_fragment$c(ctx) {
		let section1;
		let header;
		let div1;
		let img;
		let img_src_value;
		let t0;
		let div0;
		let t2;
		let nav;
		let a0;
		let t4;
		let a1;
		let t6;
		let a2;
		let t8;
		let a3;
		let t10;
		let section0;
		let icon0;
		let t11;
		let section4;
		let div2;
		let h10;
		let t13;
		let div6;
		let section2;
		let carousel0;
		let t14;
		let div5;
		let h11;
		let t16;
		let section3;
		let icon1;
		let t17;
		let p;
		let t18;
		let br;
		let t19;
		let div3;
		let h20;
		let t21;
		let each_blocks_3 = [];
		let each0_lookup = new Map();
		let t22;
		let div4;
		let h21;
		let t24;
		let ul0;
		let each_blocks_2 = [];
		let each1_lookup = new Map();
		let t25;
		let section5;
		let carousel1;
		let t26;
		let section6;
		let div7;
		let h22;
		let t28;
		let ul1;
		let t29;
		let section7;
		let t39;
		let section8;
		let h24;
		let t41;
		let div9;
		let each_blocks = [];
		let each3_lookup = new Map();
		let current;
		let mounted;
		let dispose;

		icon0 = new Icon({
				props: { myAccommodation, "aria-hidden": "true" }
			});

		carousel0 = new Carousel({ props: { images } });
		icon1 = new Icon({ props: { myAccommodation } });
		let each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
		const get_key = ctx => /*room*/ ctx[19];

		for (let i = 0; i < each_value_3.length; i += 1) {
			let child_ctx = get_each_context_3(ctx, each_value_3, i);
			let key = get_key(child_ctx);
			each0_lookup.set(key, each_blocks_3[i] = create_each_block_3(key, child_ctx));
		}

		let each_value_2 = ensure_array_like(equipementsItems);
		const get_key_1 = ctx => /*equipement*/ ctx[16].nom;

		for (let i = 0; i < each_value_2.length; i += 1) {
			let child_ctx = get_each_context_2(ctx, each_value_2, i);
			let key = get_key_1(child_ctx);
			each1_lookup.set(key, each_blocks_2[i] = create_each_block_2(key, child_ctx));
		}

		carousel1 = new Carousel({ props: { images } });
		let each_value_1 = ensure_array_like(equipmentOutdoorItems);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like(tarifs);
		const get_key_2 = ctx => /*key*/ ctx[11];

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$4(ctx, each_value, i);
			let key = get_key_2(child_ctx);
			each3_lookup.set(key, each_blocks[i] = create_each_block$4(key, child_ctx));
		}

		return {
			c() {
				section1 = element("section");
				header = element("header");
				div1 = element("div");
				img = element("img");
				t0 = space();
				div0 = element("div");
				div0.textContent = `${/*name*/ ctx[3]}`;
				t2 = space();
				nav = element("nav");
				a0 = element("a");
				a0.textContent = "DESCRIPTION";
				t4 = space();
				a1 = element("a");
				a1.textContent = "ÉQUIPEMENT";
				t6 = space();
				a2 = element("a");
				a2.textContent = "SERVICES";
				t8 = space();
				a3 = element("a");
				a3.textContent = "TARIFS";
				t10 = space();
				section0 = element("section");
				create_component(icon0.$$.fragment);
				t11 = space();
				section4 = element("section");
				div2 = element("div");
				h10 = element("h1");
				h10.textContent = `${/*title*/ ctx[0]}`;
				t13 = space();
				div6 = element("div");
				section2 = element("section");
				create_component(carousel0.$$.fragment);
				t14 = space();
				div5 = element("div");
				h11 = element("h1");
				h11.textContent = `${/*title*/ ctx[0]}`;
				t16 = space();
				section3 = element("section");
				create_component(icon1.$$.fragment);
				t17 = space();
				p = element("p");
				t18 = space();
				br = element("br");
				t19 = space();
				div3 = element("div");
				h20 = element("h2");
				h20.textContent = "Composition des chambres";
				t21 = space();

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].c();
				}

				t22 = space();
				div4 = element("div");
				h21 = element("h2");
				h21.textContent = "Équipements inclus";
				t24 = space();
				ul0 = element("ul");

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].c();
				}

				t25 = space();
				section5 = element("section");
				create_component(carousel1.$$.fragment);
				t26 = space();
				section6 = element("section");
				div7 = element("div");
				h22 = element("h2");
				h22.textContent = "Équipement extérieur";
				t28 = space();
				ul1 = element("ul");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t29 = space();
				section7 = element("section");
				section7.innerHTML = `<div class="squareService"><h2 class="serviceTitle" id="serviceHeading">Services</h2> <ul class="serviceList"><li aria-label="Animaux gratuits">Animaux gratuits</li> <li aria-label="Linge de maison fourni">Linge de maison fourni</li> <li aria-label="Lits faits à l&#39;arrivée">Lits faits à l&#39;arrivée</li> <li aria-label="Ménage fin de séjour en option*">Ménage fin de séjour en option*</li></ul></div>`;
				t39 = space();
				section8 = element("section");
				h24 = element("h2");
				h24.textContent = "Tarifs";
				t41 = space();
				div9 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(img, "class", "imgHeader");
				if (!src_url_equal(img.src, img_src_value = "src/assets/ImgBasse/basse1.png")) attr(img, "src", img_src_value);
				attr(img, "alt", "");
				attr(div0, "class", "texteImgHeader");
				attr(div1, "class", "containerHeader");
				attr(a0, "href", "#cottageDescription");
				attr(a0, "tabindex", "0");
				attr(a0, "data-section", "cottageDescription");
				attr(a0, "aria-label", "Aller à la section Description du gîte");
				attr(a1, "href", "#equipmentOutdoor");
				attr(a1, "tabindex", "0");
				attr(a1, "data-section", "equipmentOutdoor");
				attr(a1, "aria-label", "Aller à la section Équipement extérieur du gîte");
				attr(a2, "href", "#service");
				attr(a2, "tabindex", "0");
				attr(a2, "data-section", "service");
				attr(a2, "aria-label", "Aller à la section Services du gîte");
				attr(a3, "href", "#tarif");
				attr(a3, "tabindex", "0");
				attr(a3, "data-section", "tarif");
				attr(a3, "aria-label", "Aller à la section Tarifs du gîte");
				attr(nav, "class", "navigationLinks");
				attr(nav, "aria-label", "Sections du gîte");
				attr(section0, "class", "IconMobile");
				attr(section0, "role", "presentation");
				attr(section1, "class", "sectionPageCottage");
				attr(section1, "aria-labelledby", "cottageHeading");
				attr(h10, "class", "descriptionTitle");
				attr(h10, "id", "cottageDescHeading");
				attr(section2, "class", "carouselDesktop");
				attr(h11, "class", "descriptionTitleMobile");
				attr(h11, "id", "cottageDescHeading");
				attr(section3, "class", "iconDesktop");
				attr(section3, "role", "presentation");
				attr(p, "class", "container-text");
				attr(h20, "class", "roomH2");
				attr(h20, "id", "roomCompositionHeading");
				attr(div3, "class", "room-composition");
				attr(div3, "aria-labelledby", "roomCompositionHeading");
				attr(h21, "class", "EquipementH2");
				attr(div4, "class", "equipements");
				attr(div5, "class", "squareDescription");
				attr(div6, "class", "description");
				attr(section4, "id", "cottageDescription");
				attr(section4, "class", "sectionMain");
				attr(section4, "aria-labelledby", "cottageDescHeading");
				attr(section5, "class", "carouselMobile");
				attr(h22, "class", "outdoorH2");
				attr(h22, "id", "equipOutdoorHeading");
				attr(ul1, "class", "equipement-list");
				attr(div7, "class", "outdoor-equipment");
				attr(section6, "id", "equipmentOutdoor");
				attr(section6, "class", "equipment");
				attr(section6, "aria-labelledby", "equipOutdoorHeading");
				attr(section7, "id", "service");
				attr(section7, "class", "sectionService");
				attr(section7, "aria-labelledby", "serviceHeading");
				attr(h24, "class", "ratesTitle");
				attr(h24, "id", "tarifHeading");
				attr(div9, "class", "tariffDetails");
				attr(section8, "id", "tarif");
				attr(section8, "class", "rates");
				attr(section8, "aria-labelledby", "tarifHeading");
			},
			m(target, anchor) {
				insert(target, section1, anchor);
				append(section1, header);
				append(header, div1);
				append(div1, img);
				append(div1, t0);
				append(div1, div0);
				append(section1, t2);
				append(section1, nav);
				append(nav, a0);
				append(nav, t4);
				append(nav, a1);
				append(nav, t6);
				append(nav, a2);
				append(nav, t8);
				append(nav, a3);
				append(section1, t10);
				append(section1, section0);
				mount_component(icon0, section0, null);
				insert(target, t11, anchor);
				insert(target, section4, anchor);
				append(section4, div2);
				append(div2, h10);
				append(section4, t13);
				append(section4, div6);
				append(div6, section2);
				mount_component(carousel0, section2, null);
				append(div6, t14);
				append(div6, div5);
				append(div5, h11);
				append(div5, t16);
				append(div5, section3);
				mount_component(icon1, section3, null);
				append(div5, t17);
				append(div5, p);
				p.innerHTML = /*description*/ ctx[1];
				append(div5, t18);
				append(div5, br);
				append(div5, t19);
				append(div5, div3);
				append(div3, h20);
				append(div3, t21);

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					if (each_blocks_3[i]) {
						each_blocks_3[i].m(div3, null);
					}
				}

				append(div5, t22);
				append(div5, div4);
				append(div4, h21);
				append(div4, t24);
				append(div4, ul0);

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					if (each_blocks_2[i]) {
						each_blocks_2[i].m(ul0, null);
					}
				}

				insert(target, t25, anchor);
				insert(target, section5, anchor);
				mount_component(carousel1, section5, null);
				insert(target, t26, anchor);
				insert(target, section6, anchor);
				append(section6, div7);
				append(div7, h22);
				append(div7, t28);
				append(div7, ul1);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(ul1, null);
					}
				}

				insert(target, t29, anchor);
				insert(target, section7, anchor);
				insert(target, t39, anchor);
				insert(target, section8, anchor);
				append(section8, h24);
				append(section8, t41);
				append(section8, div9);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div9, null);
					}
				}

				current = true;

				if (!mounted) {
					dispose = [
						listen(a0, "click", scrollToSection),
						listen(a0, "keydown", handleKeyDown$1),
						listen(a1, "click", scrollToSection),
						listen(a1, "keydown", handleKeyDown$1),
						listen(a2, "click", scrollToSection),
						listen(a2, "keydown", handleKeyDown$1),
						listen(a3, "click", scrollToSection),
						listen(a3, "keydown", handleKeyDown$1)
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*roomComposition*/ 4) {
					each_value_3 = ensure_array_like(/*roomComposition*/ ctx[2]);
					each_blocks_3 = update_keyed_each(each_blocks_3, dirty, get_key, 1, ctx, each_value_3, each0_lookup, div3, destroy_block, create_each_block_3, null, get_each_context_3);
				}

				if (dirty & /*getClassName*/ 0) {
					each_value_1 = ensure_array_like(equipmentOutdoorItems);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(ul1, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}
			},
			i(local) {
				if (current) return;
				transition_in(icon0.$$.fragment, local);
				transition_in(carousel0.$$.fragment, local);
				transition_in(icon1.$$.fragment, local);
				transition_in(carousel1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(icon0.$$.fragment, local);
				transition_out(carousel0.$$.fragment, local);
				transition_out(icon1.$$.fragment, local);
				transition_out(carousel1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(section1);
					detach(t11);
					detach(section4);
					detach(t25);
					detach(section5);
					detach(t26);
					detach(section6);
					detach(t29);
					detach(section7);
					detach(t39);
					detach(section8);
				}

				destroy_component(icon0);
				destroy_component(carousel0);
				destroy_component(icon1);

				for (let i = 0; i < each_blocks_3.length; i += 1) {
					each_blocks_3[i].d();
				}

				for (let i = 0; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].d();
				}

				destroy_component(carousel1);
				destroy_each(each_blocks_1, detaching);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function getClassName(id) {
		return `iconEquipement ${id === 1
	? "barbecue"
	: id === 2
		? "private-parking"
		: id === 3
			? "shared-garden"
			: id === 4
				? "lounger-chair"
				: id === 5
					? "patio-furniture"
					: id === 6 ? "private-terrace" : ""}`;
	}

	function scrollToSection(event) {
		event.preventDefault();
		const sectionId = event.currentTarget.dataset.section;
		console.log("Section ID:", sectionId);
		const section = document.getElementById(sectionId);

		if (section) {
			section.scrollIntoView({ behavior: "smooth" });
		}
	}

	function handleKeyDown$1(event) {
		if (event.key === "Enter") {
			const sectionId = event.currentTarget.dataset.section;
			const section = document.getElementById(sectionId);

			if (section) {
				section.scrollIntoView({ behavior: "smooth" });
			}
		}
	}

	function instance$b($$self) {
		const cottage = combinedData.find(item => item.title === "Gîte 1 pièce");
		let { name, title, description, roomComposition } = cottage;
		return [title, description, roomComposition, name];
	}

	class Basse extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$b, create_fragment$c, safe_not_equal, {});
		}
	}

	/* src/pages/Contact.svelte generated by Svelte v4.2.12 */

	function create_if_block_3$1(ctx) {
		let div;
		let t_value = /*formData*/ ctx[0].errorMessage + "";
		let t;

		return {
			c() {
				div = element("div");
				t = text(t_value);
				attr(div, "class", "error-message");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, t);
			},
			p(ctx, dirty) {
				if (dirty & /*formData*/ 1 && t_value !== (t_value = /*formData*/ ctx[0].errorMessage + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (93:2) {#if formData.successMessage}
	function create_if_block_2$1(ctx) {
		let div;
		let t_value = /*formData*/ ctx[0].successMessage + "";
		let t;

		return {
			c() {
				div = element("div");
				t = text(t_value);
				attr(div, "class", "success-message");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, t);
			},
			p(ctx, dirty) {
				if (dirty & /*formData*/ 1 && t_value !== (t_value = /*formData*/ ctx[0].successMessage + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (158:6) {#if formData.errorMessage && !formData.subject}
	function create_if_block_1$2(ctx) {
		let p;
		let t_value = /*formData*/ ctx[0].errorMessage + "";
		let t;

		return {
			c() {
				p = element("p");
				t = text(t_value);
				attr(p, "id", "subjectError");
				attr(p, "class", "error-message");
			},
			m(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},
			p(ctx, dirty) {
				if (dirty & /*formData*/ 1 && t_value !== (t_value = /*formData*/ ctx[0].errorMessage + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (174:6) {#if formData.errorMessage && !formData.message}
	function create_if_block$5(ctx) {
		let p;
		let t_value = /*formData*/ ctx[0].errorMessage + "";
		let t;

		return {
			c() {
				p = element("p");
				t = text(t_value);
				attr(p, "id", "messageError");
				attr(p, "class", "error-message");
			},
			m(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},
			p(ctx, dirty) {
				if (dirty & /*formData*/ 1 && t_value !== (t_value = /*formData*/ ctx[0].errorMessage + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	function create_fragment$b(ctx) {
		let section1;
		let div1;
		let t4;
		let t5;
		let t6;
		let form;
		let div4;
		let div2;
		let label0;
		let t9;
		let input0;
		let t10;
		let div3;
		let label1;
		let t12;
		let input1;
		let t13;
		let div5;
		let label2;
		let t16;
		let input2;
		let t17;
		let div6;
		let label3;
		let t20;
		let input3;
		let t21;
		let div7;
		let label4;
		let t24;
		let input4;
		let t25;
		let t26;
		let div8;
		let label5;
		let t29;
		let textarea;
		let t30;
		let t31;
		let div9;
		let input5;
		let t32;
		let label6;
		let t36;
		let button;
		let t38;
		let section0;
		let p1;
		let t39;
		let br1;
		let t40;
		let a;
		let mounted;
		let dispose;
		let if_block0 = /*formData*/ ctx[0].errorMessage && create_if_block_3$1(ctx);
		let if_block1 = /*formData*/ ctx[0].successMessage && create_if_block_2$1(ctx);
		let if_block2 = /*formData*/ ctx[0].errorMessage && !/*formData*/ ctx[0].subject && create_if_block_1$2(ctx);
		let if_block3 = /*formData*/ ctx[0].errorMessage && !/*formData*/ ctx[0].message && create_if_block$5(ctx);

		return {
			c() {
				section1 = element("section");
				div1 = element("div");

				div1.innerHTML = `<div class="section-logo"><img class="logo-header" src="src/assets/logo.png" alt=""/></div> <h1 class="title-header">Contactez-nous</h1> <p class="text-header">Merci de bien vouloir remplir le formulaire ci-dessous pour nous contacter,
      que ce soit pour des demandes de location ou des demandes d&#39;informations.</p>`;

				t4 = space();
				if (if_block0) if_block0.c();
				t5 = space();
				if (if_block1) if_block1.c();
				t6 = space();
				form = element("form");
				div4 = element("div");
				div2 = element("div");
				label0 = element("label");
				label0.innerHTML = `*Nom <span class="requis">(requis)</span>`;
				t9 = space();
				input0 = element("input");
				t10 = space();
				div3 = element("div");
				label1 = element("label");
				label1.textContent = "*Prénom :";
				t12 = space();
				input1 = element("input");
				t13 = space();
				div5 = element("div");
				label2 = element("label");
				label2.innerHTML = `*E-mail <span class="requis">(requis)</span>`;
				t16 = space();
				input2 = element("input");
				t17 = space();
				div6 = element("div");
				label3 = element("label");
				label3.innerHTML = `*Numéro de téléphone <span class="requis">(requis)</span>`;
				t20 = space();
				input3 = element("input");
				t21 = space();
				div7 = element("div");
				label4 = element("label");
				label4.innerHTML = `*Sujet <span class="requis">(requis)</span>`;
				t24 = space();
				input4 = element("input");
				t25 = space();
				if (if_block2) if_block2.c();
				t26 = space();
				div8 = element("div");
				label5 = element("label");
				label5.innerHTML = `*Message <span class="requis">(requis)</span>`;
				t29 = space();
				textarea = element("textarea");
				t30 = space();
				if (if_block3) if_block3.c();
				t31 = space();
				div9 = element("div");
				input5 = element("input");
				t32 = space();
				label6 = element("label");
				label6.innerHTML = `<span class="requis">(requis)</span> <br/>**Je consens au traitement de mes données personnelles.`;
				t36 = space();
				button = element("button");
				button.textContent = "Envoyer";
				t38 = space();
				section0 = element("section");
				p1 = element("p");
				t39 = text("* Champs obligatoires. Ces informations restent confidentielles et ne seront jamais partagées avec aucun tiers.\n\n      ");
				br1 = element("br");
				t40 = text(" ** En soumettant ce formulaire, j'accepte que les informations saisies soient utilisées et traitées pour me recontacter, en réponse à ma demande d'informations, que ce soit par e-mail ou téléphone.  ");
				a = element("a");
				a.textContent = "Charte de Confidentialité";
				attr(div1, "class", "header-contact");
				attr(label0, "for", "nom");
				attr(label0, "class", "form-label");
				attr(input0, "type", "text");
				attr(input0, "id", "nom");
				attr(input0, "class", "form-name");
				attr(input0, "placeholder", "Nom");
				input0.required = true;
				attr(div2, "class", "form-group");
				attr(label1, "for", "prenom");
				attr(label1, "class", "form-label");
				attr(input1, "type", "text");
				attr(input1, "id", "prenom");
				attr(input1, "class", "form-lastname");
				attr(input1, "placeholder", "Prénom");
				attr(div3, "class", "form-group");
				attr(div4, "class", "selectName");
				attr(label2, "for", "email");
				attr(label2, "class", "form-label");
				attr(input2, "type", "email");
				attr(input2, "id", "email");
				attr(input2, "class", "common-input form-input");
				attr(input2, "placeholder", "Entrez votre e-mail");
				input2.required = true;
				attr(div5, "class", "form-group");
				attr(label3, "for", "telephone");
				attr(label3, "class", "form-label");
				attr(input3, "type", "tel");
				attr(input3, "id", "telephone");
				attr(input3, "class", "common-input form-input");
				attr(input3, "name", "telephone");
				attr(input3, "placeholder", "Entrez votre numéro");
				input3.required = true;
				attr(div6, "class", "form-group");
				attr(label4, "for", "subject");
				attr(label4, "class", "form-label");
				attr(input4, "id", "subject");
				attr(input4, "class", "common-input subjectSection");
				input4.required = true;
				attr(input4, "aria-describedby", "subjectError");
				attr(div7, "class", "form-group");
				attr(label5, "for", "message");
				attr(label5, "class", "form-label");
				attr(textarea, "id", "message");
				attr(textarea, "class", "common-input");
				attr(textarea, "rows", "4");
				textarea.required = true;
				attr(textarea, "aria-describedby", "messageError");
				attr(div8, "class", "form-group");
				attr(input5, "type", "checkbox");
				attr(input5, "id", "consent");
				input5.required = true;
				attr(label6, "for", "consent");
				attr(div9, "class", "consent-checkbox");
				attr(button, "type", "submit");
				attr(button, "class", "submit-button");
				attr(form, "class", "contact-form");
				attr(a, "href", "/privacyPolicy");
				attr(a, "aria-label", "Charte de Confidentialité");
				attr(a, "tabindex", "0");
				attr(section0, "class", "consent-text");
				attr(section1, "class", "from-section");
			},
			m(target, anchor) {
				insert(target, section1, anchor);
				append(section1, div1);
				append(section1, t4);
				if (if_block0) if_block0.m(section1, null);
				append(section1, t5);
				if (if_block1) if_block1.m(section1, null);
				append(section1, t6);
				append(section1, form);
				append(form, div4);
				append(div4, div2);
				append(div2, label0);
				append(div2, t9);
				append(div2, input0);
				set_input_value(input0, /*formData*/ ctx[0].name);
				append(div4, t10);
				append(div4, div3);
				append(div3, label1);
				append(div3, t12);
				append(div3, input1);
				set_input_value(input1, /*formData*/ ctx[0].lastname);
				append(form, t13);
				append(form, div5);
				append(div5, label2);
				append(div5, t16);
				append(div5, input2);
				set_input_value(input2, /*formData*/ ctx[0].email);
				append(form, t17);
				append(form, div6);
				append(div6, label3);
				append(div6, t20);
				append(div6, input3);
				set_input_value(input3, /*formData*/ ctx[0].phoneNumber);
				append(form, t21);
				append(form, div7);
				append(div7, label4);
				append(div7, t24);
				append(div7, input4);
				set_input_value(input4, /*formData*/ ctx[0].subject);
				append(div7, t25);
				if (if_block2) if_block2.m(div7, null);
				append(form, t26);
				append(form, div8);
				append(div8, label5);
				append(div8, t29);
				append(div8, textarea);
				set_input_value(textarea, /*formData*/ ctx[0].message);
				append(div8, t30);
				if (if_block3) if_block3.m(div8, null);
				append(form, t31);
				append(form, div9);
				append(div9, input5);
				input5.checked = /*formData*/ ctx[0].consent;
				append(div9, t32);
				append(div9, label6);
				append(form, t36);
				append(form, button);
				append(section1, t38);
				append(section1, section0);
				append(section0, p1);
				append(p1, t39);
				append(p1, br1);
				append(p1, t40);
				append(p1, a);

				if (!mounted) {
					dispose = [
						listen(input0, "input", /*input0_input_handler*/ ctx[2]),
						listen(input1, "input", /*input1_input_handler*/ ctx[3]),
						listen(input2, "input", /*input2_input_handler*/ ctx[4]),
						listen(input3, "input", /*input3_input_handler*/ ctx[5]),
						listen(input4, "input", /*input4_input_handler*/ ctx[6]),
						listen(input4, "input", /*input_handler*/ ctx[7]),
						listen(textarea, "input", /*textarea_input_handler*/ ctx[8]),
						listen(textarea, "input", /*input_handler_1*/ ctx[9]),
						listen(input5, "change", /*input5_change_handler*/ ctx[10]),
						listen(form, "submit", prevent_default(/*handleSubmit*/ ctx[1])),
						action_destroyer(link.call(null, a))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (/*formData*/ ctx[0].errorMessage) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_3$1(ctx);
						if_block0.c();
						if_block0.m(section1, t5);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*formData*/ ctx[0].successMessage) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_2$1(ctx);
						if_block1.c();
						if_block1.m(section1, t6);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*formData*/ 1 && input0.value !== /*formData*/ ctx[0].name) {
					set_input_value(input0, /*formData*/ ctx[0].name);
				}

				if (dirty & /*formData*/ 1 && input1.value !== /*formData*/ ctx[0].lastname) {
					set_input_value(input1, /*formData*/ ctx[0].lastname);
				}

				if (dirty & /*formData*/ 1 && input2.value !== /*formData*/ ctx[0].email) {
					set_input_value(input2, /*formData*/ ctx[0].email);
				}

				if (dirty & /*formData*/ 1) {
					set_input_value(input3, /*formData*/ ctx[0].phoneNumber);
				}

				if (dirty & /*formData*/ 1 && input4.value !== /*formData*/ ctx[0].subject) {
					set_input_value(input4, /*formData*/ ctx[0].subject);
				}

				if (/*formData*/ ctx[0].errorMessage && !/*formData*/ ctx[0].subject) {
					if (if_block2) {
						if_block2.p(ctx, dirty);
					} else {
						if_block2 = create_if_block_1$2(ctx);
						if_block2.c();
						if_block2.m(div7, null);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if (dirty & /*formData*/ 1) {
					set_input_value(textarea, /*formData*/ ctx[0].message);
				}

				if (/*formData*/ ctx[0].errorMessage && !/*formData*/ ctx[0].message) {
					if (if_block3) {
						if_block3.p(ctx, dirty);
					} else {
						if_block3 = create_if_block$5(ctx);
						if_block3.c();
						if_block3.m(div8, null);
					}
				} else if (if_block3) {
					if_block3.d(1);
					if_block3 = null;
				}

				if (dirty & /*formData*/ 1) {
					input5.checked = /*formData*/ ctx[0].consent;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section1);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
				if (if_block2) if_block2.d();
				if (if_block3) if_block3.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function isValidEmail(email) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	// Validation du numéro de téléphone
	function isValidPhoneNumber(phoneNumber) {
		// Utilisation d'une expression régulière pour valider le numéro de téléphone
		const phoneRegex = /^\+?\d{0,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

		return phoneRegex.test(phoneNumber);
	}

	function instance$a($$self, $$props, $$invalidate) {
		let formData = {
			access_key: "ffeeaec2-8c68-4a9f-9ce0-87f18312330e",
			// access_key: "a506e8c2-dd45-454f-a638-9b19e73f0ede",
			name: "",
			lastname: "",
			email: "",
			phoneNumber: "",
			subject: "",
			message: "",
			consent: false,
			errorMessage: "",
			successMessage: "",
			redirect: "https://web3forms.com/success"
		};

		const handleSubmit = async () => {
			if (!isValidEmail(formData.email)) {
				$$invalidate(0, formData.errorMessage = "Veuillez entrer une adresse e-mail valide.", formData);
				return;
			}

			if (!isValidPhoneNumber(formData.phoneNumber)) {
				$$invalidate(0, formData.errorMessage = "Veuillez entrer un numéro de téléphone valide.", formData);
				return;
			}

			try {
				const response = await fetch("https://api.web3forms.com/submit", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(formData)
				});

				if (response.ok) {
					$$invalidate(0, formData.successMessage = "Votre formulaire a été soumis avec succès!", formData);

					// Réinitialiser les valeurs du formulaire après soumission réussie
					$$invalidate(0, formData.name = "", formData);

					$$invalidate(0, formData.lastname = "", formData);
					$$invalidate(0, formData.email = "", formData);
					$$invalidate(0, formData.phoneNumber = "", formData);
					$$invalidate(0, formData.subject = "", formData);
					$$invalidate(0, formData.message = "", formData);
					$$invalidate(0, formData.consent = false, formData);

					// Redirection après une soumission réussie
					window.location.href = formData.redirect;
				} else {
					$$invalidate(0, formData.errorMessage = "Une erreur s'est produite lors de la soumission du formulaire. Veuillez réessayer plus tard.", formData);
				}
			} catch(error) {
				console.error("Error submitting form:", error);
				$$invalidate(0, formData.errorMessage = "Une erreur s'est produite lors de la soumission du formulaire. Veuillez réessayer plus tard.", formData);
			}
		};

		function input0_input_handler() {
			formData.name = this.value;
			$$invalidate(0, formData);
		}

		function input1_input_handler() {
			formData.lastname = this.value;
			$$invalidate(0, formData);
		}

		function input2_input_handler() {
			formData.email = this.value;
			$$invalidate(0, formData);
		}

		function input3_input_handler() {
			formData.phoneNumber = this.value;
			$$invalidate(0, formData);
		}

		function input4_input_handler() {
			formData.subject = this.value;
			$$invalidate(0, formData);
		}

		const input_handler = () => $$invalidate(0, formData.errorMessage = "", formData);

		function textarea_input_handler() {
			formData.message = this.value;
			$$invalidate(0, formData);
		}

		const input_handler_1 = () => $$invalidate(0, formData.errorMessage = "", formData);

		function input5_change_handler() {
			formData.consent = this.checked;
			$$invalidate(0, formData);
		}

		return [
			formData,
			handleSubmit,
			input0_input_handler,
			input1_input_handler,
			input2_input_handler,
			input3_input_handler,
			input4_input_handler,
			input_handler,
			textarea_input_handler,
			input_handler_1,
			input5_change_handler
		];
	}

	class Contact extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$a, create_fragment$b, safe_not_equal, {});
		}
	}

	const places = [
	    {
	      id: 1,
	      title: 'La maison et le jardin de Georges Clémenceau',
	      description: 'Cette maison de pêcheur simple a été la résidence secondaire de Georges Clémenceau, surnommé "Le Tigre", de 1919 jusqu\'à sa mort en 1929. Le jardin, conçu par Clémenceau lui-même, offre une vue imprenable sur l\'océan Atlantique et abrite une collection de sculptures et d\'objets d\'art.',
	      interest: 'Ce site est un lieu incontournable pour les amateurs d\'histoire et de politique. Il permet de découvrir l\'intimité de l\'un des hommes d\'État les plus importants de la France.',
	      practicalInfo: 'La maison et le jardin sont ouverts au public du 1er avril au 30 septembre. La visite est libre ou guidée.',
	      image: 'images/maison-clemenceau.jpg',
	      url: 'https://www.maison-de-clemenceau.fr/',
	      alt: 'Description de l\'image 1',
	      src: 'src/assets/imgLieu/lieu1.png',
	      name: 'Titre de l\'image 1'
	    },
	    {
	      id: 2,
	      title: 'L\'église de Saint-Vincent',
	      description: 'Cette église romane du XIIe siècle est classée monument historique. Elle est dédiée à Saint-Vincent, patron des vignerons. L\'église abrite un beau retable du XVIIe siècle et des fonts baptismaux du XVIe siècle.',
	      interest: 'L\'église de Saint-Vincent est un bel exemple de l\'architecture romane en Vendée. Elle offre un cadre paisible pour une visite spirituelle ou historique.',
	      practicalInfo: 'L\'église est ouverte au public tous les jours.',
	      image: 'images/eglise-saint-vincent.jpg',
	      url: 'https://fr.wikipedia.org/wiki/%C3%89glise_Saint-Vincent_de_Saint-Vincent-sur-Jard',
	      alt: 'Description de l\'image 2',
	      src: 'src/assets/imgLieu/lieu2.png',
	      name: 'Titre de l\'image 2'
	    },
	    {
	        id: 3,
	        title: "Randonnées à Saint Vincent sur Jard",
	        description: "Découvrez les sentiers pittoresques de Saint Vincent sur Jard, où la nature s'offre à vous dans toute sa splendeur. Entre dunes, forêts et marais, chaque randonnée est une invitation à l'émerveillement.",
	        interest: "Les randonnées de Saint Vincent sur Jard sont l'occasion parfaite pour se reconnecter avec la nature et admirer des paysages côtiers à couper le souffle.",
	        practicalInfo: "Les sentiers sont accessibles gratuitement et offrent divers niveaux de difficulté, adaptés à tous les amateurs de plein air.",
	        image: "images/sentier-saint-vincent-sur-jard.jpg",
	        url: "https://www.destination-vendeegrandlittoral.com/quoi-faire/balade/a-pied/circuit-de-la-pointe-du-payre/",
	        alt: "Description de l'image 3",
	        src: "src/assets/imgLieu/lieu3.png",
	        name: "Titre de l'image 3"
	    },
	    {
	      id: 4,
	      title: 'Les plages de Saint-Vincent-sur-Jard',
	      description: 'La commune de Saint-Vincent-sur-Jard possède trois plages de sable fin : la plage de la Ragnette, la plage du Goulet et la plage de Clémenceau. Ces plages sont surveillées en été et offrent de nombreuses possibilités d\'activités nautiques.',
	      interest: 'Les plages de Saint-Vincent-sur-Jard sont idéales pour se détendre, bronzer et profiter des sports nautiques. Elles offrent un cadre magnifique pour des vacances en famille ou entre amis.',
	      practicalInfo: 'Les plages de Saint-Vincent-sur-Jard sont accessibles gratuitement toute l\'année.',
	      image: 'images/plage-ragnette.jpg',
	      url: 'https://www.destination-vendeegrandlittoral.com/quoi-faire/plages/',
	      alt: 'Description de l\'image 4',
	      src: 'src/assets/imgLieu/lieu4.png',
	      name: 'Titre de l\'image 2'
	    }
	  ];

	/* src/pages/StVincentsurJard.svelte generated by Svelte v4.2.12 */

	function get_each_context$3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[16] = list[i];
		return child_ctx;
	}

	// (152:4) {#if !showAdditionalContent}
	function create_if_block_3(ctx) {
		let button;
		let mounted;
		let dispose;

		return {
			c() {
				button = element("button");
				button.textContent = "Afficher plus";
				attr(button, "class", "readMore");
			},
			m(target, anchor) {
				insert(target, button, anchor);

				if (!mounted) {
					dispose = listen(button, "click", /*toggleText*/ ctx[4]);
					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (156:4) {#if showAdditionalContent}
	function create_if_block_2(ctx) {
		let p;
		let t1;
		let button;
		let mounted;
		let dispose;

		return {
			c() {
				p = element("p");
				p.textContent = "Ce village côtier, baigné de la lumière douce du soleil, séduit les\n        visiteurs par son atmosphère paisible et son riche patrimoine. Du\n        célèbre jardin de Georges Clémenceau aux sentiers sauvages de randonnée,\n        chaque coin de Saint-Vincent-sur-Jard révèle une facette unique de son\n        histoire et de sa beauté naturelle.";
				t1 = space();
				button = element("button");
				button.textContent = "×";
				attr(button, "class", "readMore");
			},
			m(target, anchor) {
				insert(target, p, anchor);
				insert(target, t1, anchor);
				insert(target, button, anchor);

				if (!mounted) {
					dispose = listen(button, "click", /*toggleText*/ ctx[4]);
					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
					detach(t1);
					detach(button);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (200:2) {#each places as place (place.id)}
	function create_each_block$3(key_1, ctx) {
		let div2;
		let div0;
		let t0;
		let div1;
		let h2;
		let t2;
		let p;
		let t5;
		let a;
		let t7;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[10](/*place*/ ctx[16]);
		}

		function keydown_handler(...args) {
			return /*keydown_handler*/ ctx[11](/*place*/ ctx[16], ...args);
		}

		return {
			key: key_1,
			first: null,
			c() {
				div2 = element("div");
				div0 = element("div");
				div0.innerHTML = `<img loading="lazy" src="${/*place*/ ctx[16].src}" alt="${/*place*/ ctx[16].alt}" title="${/*place*/ ctx[16].name}"/>`;
				t0 = space();
				div1 = element("div");
				h2 = element("h2");
				h2.textContent = `${/*place*/ ctx[16].title}`;
				t2 = space();
				p = element("p");
				p.textContent = `${/*place*/ ctx[16].description.substring(0, 100)}...`;
				t5 = space();
				a = element("a");
				a.textContent = "En savoir plus";
				t7 = space();
				attr(div0, "class", "site-image");
				attr(a, "class", "linkPlace");
				attr(a, "href", "javascript:void(0)");
				attr(a, "tabindex", "0");
				attr(div1, "class", "site-description");
				attr(div2, "class", "tourist-site scroll-animation");
				attr(div2, "aria-label", /*place*/ ctx[16].title);
				this.first = div2;
			},
			m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div2, t0);
				append(div2, div1);
				append(div1, h2);
				append(div1, t2);
				append(div1, p);
				append(div1, t5);
				append(div1, a);
				append(div2, t7);

				if (!mounted) {
					dispose = [
						listen(a, "click", stop_propagation(click_handler)),
						listen(a, "keydown", keydown_handler)
					];

					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(div2);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (229:2) {#if showModal}
	function create_if_block_1$1(ctx) {
		let div1;
		let div0;
		let span;
		let t1;
		let h2;
		let t2_value = /*modalContent*/ ctx[1].title + "";
		let t2;
		let t3;
		let img;
		let img_src_value;
		let img_alt_value;
		let img_title_value;
		let t4;
		let h30;
		let t6;
		let p0;
		let t7_value = /*modalContent*/ ctx[1].description + "";
		let t7;
		let t8;
		let h31;
		let t10;
		let p1;
		let t11_value = /*modalContent*/ ctx[1].interest + "";
		let t11;
		let t12;
		let h32;
		let t14;
		let p2;
		let t15_value = /*modalContent*/ ctx[1].practicalInfo + "";
		let t15;
		let t16;
		let h33;
		let t18;
		let a;
		let t19;
		let a_href_value;
		let mounted;
		let dispose;

		return {
			c() {
				div1 = element("div");
				div0 = element("div");
				span = element("span");
				span.textContent = "×";
				t1 = space();
				h2 = element("h2");
				t2 = text(t2_value);
				t3 = space();
				img = element("img");
				t4 = space();
				h30 = element("h3");
				h30.textContent = "Description";
				t6 = space();
				p0 = element("p");
				t7 = text(t7_value);
				t8 = space();
				h31 = element("h3");
				h31.textContent = "Intérêt touristique";
				t10 = space();
				p1 = element("p");
				t11 = text(t11_value);
				t12 = space();
				h32 = element("h3");
				h32.textContent = "Informations pratiques";
				t14 = space();
				p2 = element("p");
				t15 = text(t15_value);
				t16 = space();
				h33 = element("h3");
				h33.textContent = "Lien vers site";
				t18 = space();
				a = element("a");
				t19 = text("Cliquez ici pour en savoir plus");
				attr(span, "class", "close-button");
				attr(span, "role", "button");
				attr(span, "tabindex", "0");
				attr(img, "loading", "lazy");
				if (!src_url_equal(img.src, img_src_value = /*modalContent*/ ctx[1].src)) attr(img, "src", img_src_value);
				attr(img, "alt", img_alt_value = /*modalContent*/ ctx[1].alt);
				attr(img, "title", img_title_value = /*modalContent*/ ctx[1].name);
				attr(a, "href", a_href_value = /*modalContent*/ ctx[1].url);
				attr(div0, "class", "modalContent");
				attr(div1, "class", "modalLieu");
				attr(div1, "role", "dialog");
				attr(div1, "aria-modal", "true");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, span);
				append(div0, t1);
				append(div0, h2);
				append(h2, t2);
				append(div0, t3);
				append(div0, img);
				append(div0, t4);
				append(div0, h30);
				append(div0, t6);
				append(div0, p0);
				append(p0, t7);
				append(div0, t8);
				append(div0, h31);
				append(div0, t10);
				append(div0, p1);
				append(p1, t11);
				append(div0, t12);
				append(div0, h32);
				append(div0, t14);
				append(div0, p2);
				append(p2, t15);
				append(div0, t16);
				append(div0, h33);
				append(div0, t18);
				append(div0, a);
				append(a, t19);

				if (!mounted) {
					dispose = [
						listen(span, "click", /*closeModal*/ ctx[6]),
						listen(span, "keydown", /*keydown_handler_1*/ ctx[12]),
						listen(a, "click", prevent_default(/*click_handler_1*/ ctx[13]))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*modalContent*/ 2 && t2_value !== (t2_value = /*modalContent*/ ctx[1].title + "")) set_data(t2, t2_value);

				if (dirty & /*modalContent*/ 2 && !src_url_equal(img.src, img_src_value = /*modalContent*/ ctx[1].src)) {
					attr(img, "src", img_src_value);
				}

				if (dirty & /*modalContent*/ 2 && img_alt_value !== (img_alt_value = /*modalContent*/ ctx[1].alt)) {
					attr(img, "alt", img_alt_value);
				}

				if (dirty & /*modalContent*/ 2 && img_title_value !== (img_title_value = /*modalContent*/ ctx[1].name)) {
					attr(img, "title", img_title_value);
				}

				if (dirty & /*modalContent*/ 2 && t7_value !== (t7_value = /*modalContent*/ ctx[1].description + "")) set_data(t7, t7_value);
				if (dirty & /*modalContent*/ 2 && t11_value !== (t11_value = /*modalContent*/ ctx[1].interest + "")) set_data(t11, t11_value);
				if (dirty & /*modalContent*/ 2 && t15_value !== (t15_value = /*modalContent*/ ctx[1].practicalInfo + "")) set_data(t15, t15_value);

				if (dirty & /*modalContent*/ 2 && a_href_value !== (a_href_value = /*modalContent*/ ctx[1].url)) {
					attr(a, "href", a_href_value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (261:0) {#if dialogVisible}
	function create_if_block$4(ctx) {
		let div1;
		let p;
		let t1;
		let div0;
		let button0;
		let t3;
		let button1;
		let mounted;
		let dispose;

		return {
			c() {
				div1 = element("div");
				p = element("p");
				p.textContent = "Vous allez être redirigé vers un autre site. Voulez-vous\n      continuer ?";
				t1 = space();
				div0 = element("div");
				button0 = element("button");
				button0.textContent = "Oui";
				t3 = space();
				button1 = element("button");
				button1.textContent = "Non";
				attr(button0, "class", "confirmButton");
				attr(button1, "class", "cancelButton");
				attr(div0, "class", "buttonContainer");
				attr(div1, "class", "customDialog");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, p);
				append(div1, t1);
				append(div1, div0);
				append(div0, button0);
				append(div0, t3);
				append(div0, button1);

				if (!mounted) {
					dispose = [
						listen(button0, "click", /*proceedToSite*/ ctx[8]),
						listen(button1, "click", /*cancelRedirect*/ ctx[9])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$a(ctx) {
		let section0;
		let div;
		let t1;
		let article0;
		let p0;
		let t3;
		let t4;
		let t5;
		let article1;
		let t8;
		let button;
		let t9;
		let section1;
		let t10;
		let section2;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let t11;
		let section3;
		let t12;
		let if_block3_anchor;
		let mounted;
		let dispose;
		let if_block0 = !/*showAdditionalContent*/ ctx[2] && create_if_block_3(ctx);
		let if_block1 = /*showAdditionalContent*/ ctx[2] && create_if_block_2(ctx);
		let each_value = ensure_array_like(places);
		const get_key = ctx => /*place*/ ctx[16].id;

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$3(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
		}

		let if_block2 = /*showModal*/ ctx[0] && create_if_block_1$1(ctx);
		let if_block3 = /*dialogVisible*/ ctx[3] && create_if_block$4(ctx);

		return {
			c() {
				section0 = element("section");
				div = element("div");
				div.innerHTML = `<h1><strong class="titreDescription">Saint-Vincent-sur-Jard</strong></h1>`;
				t1 = space();
				article0 = element("article");
				p0 = element("p");
				p0.textContent = "Niché sur les côtes venteuses de l'Atlantique, Saint-Vincent-sur-Jard est\n      un petit bijou de la Vendée, offrant un mélange envoûtant de charme\n      historique, de paysages naturels préservés et de détente balnéaire.";
				t3 = space();
				if (if_block0) if_block0.c();
				t4 = space();
				if (if_block1) if_block1.c();
				t5 = space();
				article1 = element("article");

				article1.innerHTML = `<p>Niché sur les côtes venteuses de l&#39;Atlantique, Saint-Vincent-sur-Jard est
      un petit bijou de la Vendée, offrant un mélange envoûtant de charme
      historique, de paysages naturels préservés et de détente balnéaire.
   
        Ce village côtier, baigné de la lumière douce du soleil, séduit les
        visiteurs par son atmosphère paisible et son riche patrimoine. Du
        célèbre jardin de Georges Clémenceau aux sentiers sauvages de randonnée,
        chaque coin de Saint-Vincent-sur-Jard révèle une facette unique de son
        histoire et de sa beauté naturelle.</p> <img class="logoVendee" src="src/assets/logo-vendee.png" alt="Logo de la Vendée"/>`;

				t8 = space();
				button = element("button");
				button.innerHTML = `<span></span>`;
				t9 = space();
				section1 = element("section");
				t10 = space();
				section2 = element("section");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t11 = space();
				section3 = element("section");
				if (if_block2) if_block2.c();
				t12 = space();
				if (if_block3) if_block3.c();
				if_block3_anchor = empty();
				attr(article0, "class", "main-content");
				attr(article1, "class", "main-content-desktop");
				attr(section0, "aria-labelledby", "pageTitle");
				attr(section0, "class", "descriptionHeader");
				attr(button, "id", "boutonScroll");
				attr(section1, "class", "sectionTexteLieu");
				attr(section2, "class", "sectionTexteLieu");
			},
			m(target, anchor) {
				insert(target, section0, anchor);
				append(section0, div);
				append(section0, t1);
				append(section0, article0);
				append(article0, p0);
				append(article0, t3);
				if (if_block0) if_block0.m(article0, null);
				append(article0, t4);
				if (if_block1) if_block1.m(article0, null);
				append(section0, t5);
				append(section0, article1);
				insert(target, t8, anchor);
				insert(target, button, anchor);
				insert(target, t9, anchor);
				insert(target, section1, anchor);
				insert(target, t10, anchor);
				insert(target, section2, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(section2, null);
					}
				}

				insert(target, t11, anchor);
				insert(target, section3, anchor);
				if (if_block2) if_block2.m(section3, null);
				insert(target, t12, anchor);
				if (if_block3) if_block3.m(target, anchor);
				insert(target, if_block3_anchor, anchor);

				if (!mounted) {
					dispose = listen(button, "click", scrollToFirstSection);
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (!/*showAdditionalContent*/ ctx[2]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_3(ctx);
						if_block0.c();
						if_block0.m(article0, t4);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*showAdditionalContent*/ ctx[2]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_2(ctx);
						if_block1.c();
						if_block1.m(article0, null);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*openModal*/ 32) {
					each_value = ensure_array_like(places);
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, section2, destroy_block, create_each_block$3, null, get_each_context$3);
				}

				if (/*showModal*/ ctx[0]) {
					if (if_block2) {
						if_block2.p(ctx, dirty);
					} else {
						if_block2 = create_if_block_1$1(ctx);
						if_block2.c();
						if_block2.m(section3, null);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if (/*dialogVisible*/ ctx[3]) {
					if (if_block3) {
						if_block3.p(ctx, dirty);
					} else {
						if_block3 = create_if_block$4(ctx);
						if_block3.c();
						if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
					}
				} else if (if_block3) {
					if_block3.d(1);
					if_block3 = null;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section0);
					detach(t8);
					detach(button);
					detach(t9);
					detach(section1);
					detach(t10);
					detach(section2);
					detach(t11);
					detach(section3);
					detach(t12);
					detach(if_block3_anchor);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				if (if_block2) if_block2.d();
				if (if_block3) if_block3.d(detaching);
				mounted = false;
				dispose();
			}
		};
	}

	function fetchData() {
		fetch('../dataImport/dataLieu/lieu.json').then(
			response => {
				if (!response.ok) {
					throw new Error('Erreur lors de la récupération des données');
				}

				return response.json();
			}
		).then(data => {
			// Traitez les données récupérées
			console.log('Données des lieux récupérées :', data);

			// Mettez à jour votre variable places avec les données récupérées en utilisant setPlaces
			setPlaces(data);

			// Vous n'avez plus besoin de réaffecter places ici
			// Stockez les données en cache
			cacheData();
		}).catch(error => {
			console.error('Erreur :', error);
		});
	}

	function handleScroll() {
		const scrollPosition = window.scrollY;
		const windowHeight = window.innerHeight;
		const elements = document.querySelectorAll(".scroll-animation");

		elements.forEach(element => {
			const elementPosition = element.offsetTop;
			element.offsetHeight;
			const startToShow = elementPosition - windowHeight + 10;

			if (scrollPosition > startToShow) {
				element.classList.add("show");
			} else {
				element.classList.remove("show");
			}
		});
	}

	function handleScrollAppear() {
		const boutonScroll = document.getElementById('boutonScroll');

		if (boutonScroll) {
			boutonScroll.style.display = window.scrollY === 0 ? 'block' : 'none';
		}
	}

	function scrollToFirstSection() {
		const section = document.querySelector('.sectionTexteLieu');
		const boutonScroll = document.getElementById('boutonScroll');

		if (section) {
			window.scrollTo({
				top: section.offsetTop,
				behavior: 'smooth'
			});

			boutonScroll.style.display = 'none';
		}
	}

	function instance$9($$self, $$props, $$invalidate) {
		let showModal = false;

		let modalContent = {
			id: "",
			title: "",
			description: "",
			interest: "",
			practicalInfo: "",
			url: "",
			src: "",
			alt: "",
			name: ""
		};

		// Appel de fetchData lorsque la page est chargée
		window.addEventListener('load', () => {
			fetchData();
		});

		let showAdditionalContent = false;

		function toggleText() {
			$$invalidate(2, showAdditionalContent = !showAdditionalContent);
		}

		const openModal = content => {
			$$invalidate(1, modalContent = { ...content }); // Utilisation de la déstructuration pour éviter les mutations directes
			$$invalidate(0, showModal = true);
		};

		const closeModal = () => {
			$$invalidate(0, showModal = false);
		};

		let dialogDetails = {};
		let dialogVisible = false;

		const confirmRedirect = (url, name) => {
			dialogDetails = { url, name }; // Utilisation de la déstructuration pour éviter les mutations directes
			$$invalidate(3, dialogVisible = true);
		};

		const proceedToSite = () => {
			window.open(dialogDetails.url, "_blank");
			$$invalidate(3, dialogVisible = false);
		};

		const cancelRedirect = () => {
			$$invalidate(3, dialogVisible = false);
		};

		let ticking = false;

		window.addEventListener("scroll", () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					handleScroll();
					handleScrollAppear();
					ticking = false;
				});

				ticking = true;
			}
		});

		const click_handler = place => openModal(place);

		const keydown_handler = (place, event) => {
			if (event.key === 'Enter') {
				openModal(place);
			}
		};

		const keydown_handler_1 = event => {
			if (event.key === 'Enter' || event.key === 'Escape') {
				closeModal();
			}
		};

		const click_handler_1 = () => confirmRedirect(modalContent.url, modalContent.name);

		return [
			showModal,
			modalContent,
			showAdditionalContent,
			dialogVisible,
			toggleText,
			openModal,
			closeModal,
			confirmRedirect,
			proceedToSite,
			cancelRedirect,
			click_handler,
			keydown_handler,
			keydown_handler_1,
			click_handler_1
		];
	}

	class StVincentsurJard extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$9, create_fragment$a, safe_not_equal, {});
		}
	}

	/* src/pages/Agreement.svelte generated by Svelte v4.2.12 */

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[1] = list[i];
		return child_ctx;
	}

	// (62:4) {#each agreement as item}
	function create_each_block$2(ctx) {
		let section;
		let h2;
		let t1;
		let p;
		let t3;

		return {
			c() {
				section = element("section");
				h2 = element("h2");
				h2.textContent = `${/*item*/ ctx[1].title}`;
				t1 = space();
				p = element("p");
				p.textContent = `${/*item*/ ctx[1].content}`;
				t3 = space();
				attr(h2, "class", "section-title");
				attr(p, "class", "section-content");
				attr(section, "class", "agreement-section");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, h2);
				append(section, t1);
				append(section, p);
				append(section, t3);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}
			}
		};
	}

	function create_fragment$9(ctx) {
		let section;
		let main;
		let h1;
		let t1;
		let each_value = ensure_array_like(/*agreement*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
		}

		return {
			c() {
				section = element("section");
				main = element("main");
				h1 = element("h1");
				h1.textContent = "Parenthèse Océane - Conditions Générales de Vente";
				t1 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(h1, "class", "page-title");
				attr(main, "class", "container_agr");
				attr(section, "class", "agreement");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, main);
				append(main, h1);
				append(main, t1);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(main, null);
					}
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*agreement*/ 1) {
					each_value = ensure_array_like(/*agreement*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(main, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance$8($$self) {
		let agreement = [
			{
				title: "Article 1 - Objet",
				content: "Ce contrat de location est destiné à l’usage exclusif de la réservation de gîtes."
			},
			{
				title: "Article 2 - Durée du Séjour",
				content: "Le locataire signataire du présent contrat conclu pour une durée déterminée ne pourra en aucune circonstance se prévaloir d'un quelconque droit au maintien dans les lieux à l'issue du séjour."
			},
			{
				title: "Article 3 - Conclusion du Contrat",
				content: "La réservation devient effective dès lors que le locataire aura fait parvenir au propriétaire l’acompte indiqué au recto ainsi qu’un exemplaire du contrat signé avant la date indiquée au recto. Un deuxième exemplaire est à conserver par le locataire. La location conclue entre les parties au présent acte ne peut en aucun cas bénéficier même partiellement à des tiers, personnes physiques ou morales, sauf accord écrit du propriétaire. Toute infraction à ce dernier alinéa serait susceptible d'entraîner la résiliation immédiate de la location aux torts du locataire, le produit de la location restant définitivement acquis au propriétaire."
			},
			{
				title: "Article 4 - Absence de Rétractation",
				content: "Pour les réservations effectuées par courrier, par téléphone ou par internet, le locataire ne bénéficie pas du délai de rétractation, et ce conformément à l’article L121-20-4 du code de la consommation relatif notamment aux prestations de services d’hébergement fournies à une date ou selon une périodicité déterminée."
			},
			{
				title: "Article 5 - Annulation par le Locataire",
				content: "Toute annulation doit être notifiée au propriétaire par lettre recommandée avec accusé de réception. a) Annulation avant l'arrivée dans les lieux : L'acompte reste acquis au propriétaire. Celui-ci pourra demander le solde du montant du séjour, si l'annulation intervient moins de 30 jours avant la date prévue d'entrée dans les lieux. Si le locataire ne se manifeste pas dans les 24 heures qui suivent la date d'arrivée indiquée sur le contrat, le présent contrat devient nul et le propriétaire peut disposer de son gîte. L'acompte reste également acquis au propriétaire qui demandera le solde de la location. b) Si le séjour est écourté, le prix de la location reste acquis au propriétaire. Il ne sera procédé à aucun remboursement."
			},
			{
				title: "Article 6 - Annulation par le Propriétaire",
				content: "Le propriétaire reverse au locataire l’intégralité des sommes versées par avance."
			},
			{
				title: "Article 7 - Arrivée",
				content: "Le locataire doit se présenter le jour précisé dans le créneau horaire mentionné sur le présent contrat. En cas d'arrivée tardive ou différée, le locataire doit prévenir le propriétaire."
			},
			{
				title: "Article 8 - Règlement du Solde",
				content: "Le solde de la location est à régler à l'entrée dans les lieux."
			},
			{
				title: "Article 9 – Taxes de Séjour",
				content: "Les tarifs de location ne comprennent pas les taxes de séjour. Les taxes de séjour applicables en 2024, selon la réglementation locale, sont de 0,71 € par jour et par adulte de plus de 18 ans pour un gîte classé 2 étoiles, et de 0,77 € par jour et par adulte de plus de 18 ans pour un gîte classé 3 étoiles. Ces taxes seront collectées auprès des clients à leurs arrivées pour les séjours effectués entre le 01 avril et le 30 septembre."
			},
			{
				title: "Article 10 - Conditions de Paiement",
				content: "a. Pour réserver un séjour aux gîtes Parenthèse Océane situés au 32, rue de Saint-Hilaire à Saint-Vincent sur Jard, en Vendée, les clients doivent effectuer un paiement initial de 30% du montant total de la location au moment de la réservation. b. Le solde restant doit être réglé au plus tard 30 jours avant la date d'arrivée prévue. c. Tous les paiements doivent être effectués conformément aux méthodes de paiement acceptées par Parenthèse Océane, telles Chèque bancaire à l'ordre de M. Pascal FOUESNANT ou Virement bancaire."
			},
			{
				title: "Article 11 - Responsabilités",
				content: "a. Les clients sont responsables de respecter les règles et réglementations applicables aux gîtes Parenthèse Océane. b. Tout dommage matériel causé aux installations pendant le séjour sera facturé au client."
			},
			{
				title: "Article 12 - Modification des Conditions",
				content: "Parenthèse Océane se réserve le droit de modifier les présentes conditions générales de vente. Les clients seront informés de toute modification via les canaux de communication appropriés."
			},
			{
				title: "Article 13 - Litiges",
				content: "Toute réclamation relative à la location sera traitée par le Tribunal compétent. En confirmant une réservation aux gîtes Parenthèse Océane, les clients reconnaissent avoir lu, compris et accepté les présentes conditions générales de vente."
			}
		];

		return [agreement];
	}

	class Agreement extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$8, create_fragment$9, safe_not_equal, {});
		}
	}

	/* src/pages/PrivacyPolicy.svelte generated by Svelte v4.2.12 */

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[1] = list[i].section;
		child_ctx[2] = list[i].description;
		return child_ctx;
	}

	// (19:8) {#each privacyPolicyData as { section, description }}
	function create_each_block$1(ctx) {
		let div;
		let h2;
		let t1;
		let p;
		let t3;

		return {
			c() {
				div = element("div");
				h2 = element("h2");
				h2.textContent = `${/*section*/ ctx[1]}`;
				t1 = space();
				p = element("p");
				p.textContent = `${/*description*/ ctx[2]}`;
				t3 = space();
				attr(div, "class", "confidentialityPolicy");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, h2);
				append(div, t1);
				append(div, p);
				append(div, t3);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function create_fragment$8(ctx) {
		let section_1;
		let h1;
		let t1;
		let each_value = ensure_array_like(/*privacyPolicyData*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		return {
			c() {
				section_1 = element("section");
				h1 = element("h1");
				h1.textContent = "Charte de Confidentialité";
				t1 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(h1, "id", "privacyPolicyTitle");
				attr(section_1, "class", "privacyPolicy");
				attr(section_1, "aria-labelledby", "privacyPolicyTitle");
			},
			m(target, anchor) {
				insert(target, section_1, anchor);
				append(section_1, h1);
				append(section_1, t1);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(section_1, null);
					}
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*privacyPolicyData*/ 1) {
					each_value = ensure_array_like(/*privacyPolicyData*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(section_1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section_1);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance$7($$self) {
		const privacyPolicyData = [
			{
				section: 'Introduction',
				description: 'La présente Charte de Confidentialité régit la manière dont Parenthèse Océane collecte, utilise, conserve et divulgue les informations recueillies auprès des utilisateurs (chacun, un "Utilisateur") de notre site web ([URL du site]). Cette charte de confidentialité s\'applique au site et à tous les produits et services proposés par Parenthèse Océane.'
			},
			{
				section: 'Collecte d\'Informations Personnelles',
				description: 'Nous collectons les informations que vous fournissez volontairement lorsque vous remplissez le formulaire de contact sur notre site. Ces informations peuvent inclure, mais ne sont pas limitées à :\n- Nom et prénom\n- Adresse e-mail\n- Numéro de téléphone\n- Sujet de votre demande\n- Message détaillant votre demande'
			},
			{
				section: 'Utilisation des Informations Collectées',
				description: 'Les informations que vous nous fournissez sont utilisées uniquement dans le but de répondre à votre demande de contact. Nous ne partageons pas ces informations avec des tiers, sauf dans les cas où cela est nécessaire pour répondre à votre demande spécifique.'
			},
			{
				section: 'Protection de Vos Informations Personnelles',
				description: 'Nous prenons des mesures de sécurité appropriées pour protéger vos informations personnelles contre tout accès non autorisé, altération, divulgation ou destruction.'
			},
			{
				section: 'Modification de la Charte de Confidentialité',
				description: 'Parenthèse Océane se réserve le droit de mettre à jour cette charte de confidentialité à tout moment. Nous vous encourageons à consulter fréquemment cette page pour rester informé des modifications. Vous reconnaissez et acceptez qu\'il est de votre responsabilité de revoir périodiquement cette charte de confidentialité et de vous familiariser avec les modifications.'
			},
			{
				section: 'Votre Acceptation de Cette Charte',
				description: 'En utilisant ce site, vous signifiez votre acceptation de cette charte de confidentialité. Si vous n\'acceptez pas cette charte, veuillez ne pas utiliser notre site.'
			},
			{
				section: 'Contactez-nous',
				description: 'Si vous avez des questions concernant cette charte de confidentialité, veuillez nous contacter à :\nParenthèse Océane\n32 Route de Saint-Hilaire\n85520 Saint-Vincent-sur-Jard\nTéléphone : +33 1 23 45 67 89\nE-mail : parentheseoceane@orange.fr'
			}
		];

		return [privacyPolicyData];
	}

	class PrivacyPolicy extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$7, create_fragment$8, safe_not_equal, {});
		}
	}

	var routes = {
	    "/": Home,
	    "/haute": Haute,
	    "/etale": Etale,
	    "/basse": Basse,
	    "/contact": Contact,
	    "/info": Info,
	    "/stVincentsurJard/": StVincentsurJard,
	    "/agreement": Agreement,
	    "/privacyPolicy": PrivacyPolicy,
	    "*": NotFound,

	};

	/* eslint-disable @typescript-eslint/no-explicit-any */
	// This file taken from rgossiaux/svelte-headlessui
	// Copyright 2020-present Hunter Perrin
	function useActions(node, actions) {
	    const actionReturns = [];
	    if (actions) {
	        for (let i = 0; i < actions.length; i++) {
	            const actionEntry = actions[i];
	            const action = Array.isArray(actionEntry) ? actionEntry[0] : actionEntry;
	            if (Array.isArray(actionEntry) && actionEntry.length > 1) {
	                actionReturns.push(action(node, actionEntry[1]));
	            }
	            else {
	                actionReturns.push(action(node));
	            }
	        }
	    }
	    return {
	        update(actions) {
	            if (((actions && actions.length) || 0) != actionReturns.length) {
	                throw new Error('You must not change the length of an actions array.');
	            }
	            if (actions) {
	                for (let i = 0; i < actions.length; i++) {
	                    const returnEntry = actionReturns[i];
	                    if (returnEntry && returnEntry.update) {
	                        const actionEntry = actions[i];
	                        if (Array.isArray(actionEntry) && actionEntry.length > 1) {
	                            returnEntry.update(actionEntry[1]);
	                        }
	                        else {
	                            returnEntry.update();
	                        }
	                    }
	                }
	            }
	        },
	        destroy() {
	            for (let i = 0; i < actionReturns.length; i++) {
	                const returnEntry = actionReturns[i];
	                if (returnEntry && returnEntry.destroy) {
	                    returnEntry.destroy();
	                }
	            }
	        }
	    };
	}

	/* eslint-disable @typescript-eslint/no-empty-function */
	/* eslint-disable @typescript-eslint/no-explicit-any */
	const MODIFIER_DIVIDER = '!';
	const modifierRegex = new RegExp(`^[^${MODIFIER_DIVIDER}]+(?:${MODIFIER_DIVIDER}(?:preventDefault|stopPropagation|passive|nonpassive|capture|once|self))+$`);
	/** Function for forwarding DOM events to the component's declaration */
	function createEventForwarder(component, except = []) {
	    // This is our pseudo $on function. It is defined on component mount.
	    let $on;
	    // This is a list of events bound before mount.
	    const events = [];
	    // And we override the $on function to forward all bound events.
	    component.$on = (fullEventType, callback) => {
	        const eventType = fullEventType;
	        let destructor = () => { };
	        for (const exception of except) {
	            if (typeof exception === 'string' && exception === eventType) {
	                // Bail out of the event forwarding and run the normal Svelte $on() code
	                const callbacks = component.$$.callbacks[eventType] || (component.$$.callbacks[eventType] = []);
	                callbacks.push(callback);
	                return () => {
	                    const index = callbacks.indexOf(callback);
	                    if (index !== -1)
	                        callbacks.splice(index, 1);
	                };
	            }
	            if (typeof exception === 'object' && exception['name'] === eventType) {
	                const oldCallback = callback;
	                callback = (...props) => {
	                    if (!(typeof exception === 'object' && exception['shouldExclude']())) {
	                        oldCallback(...props);
	                    }
	                };
	            }
	        }
	        if ($on) {
	            // The event was bound programmatically.
	            destructor = $on(eventType, callback);
	        }
	        else {
	            // The event was bound before mount by Svelte.
	            events.push([eventType, callback]);
	        }
	        return () => {
	            destructor();
	        };
	    };
	    function forward(e) {
	        // Internally bubble the event up from Svelte components.
	        bubble(component, e);
	    }
	    return (node) => {
	        const destructors = [];
	        const forwardDestructors = {};
	        // This function is responsible for listening and forwarding
	        // all bound events.
	        $on = (fullEventType, callback) => {
	            let eventType = fullEventType;
	            let handler = callback;
	            // DOM addEventListener options argument.
	            let options = false;
	            const modifierMatch = eventType.match(modifierRegex);
	            if (modifierMatch) {
	                // Parse the event modifiers.
	                // Supported modifiers:
	                // - preventDefault
	                // - stopPropagation
	                // - passive
	                // - nonpassive
	                // - capture
	                // - once
	                const parts = eventType.split(MODIFIER_DIVIDER);
	                eventType = parts[0];
	                const eventOptions = Object.fromEntries(parts.slice(1).map((mod) => [mod, true]));
	                if (eventOptions.passive) {
	                    options = options || {};
	                    options.passive = true;
	                }
	                if (eventOptions.nonpassive) {
	                    options = options || {};
	                    options.passive = false;
	                }
	                if (eventOptions.capture) {
	                    options = options || {};
	                    options.capture = true;
	                }
	                if (eventOptions.once) {
	                    options = options || {};
	                    options.once = true;
	                }
	                if (eventOptions.preventDefault) {
	                    handler = prevent_default(handler);
	                }
	                if (eventOptions.stopPropagation) {
	                    handler = stop_propagation(handler);
	                }
	            }
	            // Listen for the event directly, with the given options.
	            const off = listen(node, eventType, handler, options);
	            const destructor = () => {
	                off();
	                const idx = destructors.indexOf(destructor);
	                if (idx > -1) {
	                    destructors.splice(idx, 1);
	                }
	            };
	            destructors.push(destructor);
	            // Forward the event from Svelte.
	            if (!(eventType in forwardDestructors)) {
	                forwardDestructors[eventType] = listen(node, eventType, forward);
	            }
	            return destructor;
	        };
	        for (let i = 0; i < events.length; i++) {
	            // Listen to all the events added before mount.
	            $on(events[i][0], events[i][1]);
	        }
	        return {
	            destroy: () => {
	                // Remove all event listeners.
	                for (let i = 0; i < destructors.length; i++) {
	                    destructors[i]();
	                }
	                // Remove all event forwarders.
	                for (const entry of Object.entries(forwardDestructors)) {
	                    entry[1]();
	                }
	            }
	        };
	    };
	}

	/** --------------------- */
	const key = {};
	function useSvelteUIThemeContext() {
	    return getContext(key);
	}

	const colorScheme = writable('light');

	var t="colors",n="sizes",r="space",i={gap:r,gridGap:r,columnGap:r,gridColumnGap:r,rowGap:r,gridRowGap:r,inset:r,insetBlock:r,insetBlockEnd:r,insetBlockStart:r,insetInline:r,insetInlineEnd:r,insetInlineStart:r,margin:r,marginTop:r,marginRight:r,marginBottom:r,marginLeft:r,marginBlock:r,marginBlockEnd:r,marginBlockStart:r,marginInline:r,marginInlineEnd:r,marginInlineStart:r,padding:r,paddingTop:r,paddingRight:r,paddingBottom:r,paddingLeft:r,paddingBlock:r,paddingBlockEnd:r,paddingBlockStart:r,paddingInline:r,paddingInlineEnd:r,paddingInlineStart:r,top:r,right:r,bottom:r,left:r,scrollMargin:r,scrollMarginTop:r,scrollMarginRight:r,scrollMarginBottom:r,scrollMarginLeft:r,scrollMarginX:r,scrollMarginY:r,scrollMarginBlock:r,scrollMarginBlockEnd:r,scrollMarginBlockStart:r,scrollMarginInline:r,scrollMarginInlineEnd:r,scrollMarginInlineStart:r,scrollPadding:r,scrollPaddingTop:r,scrollPaddingRight:r,scrollPaddingBottom:r,scrollPaddingLeft:r,scrollPaddingX:r,scrollPaddingY:r,scrollPaddingBlock:r,scrollPaddingBlockEnd:r,scrollPaddingBlockStart:r,scrollPaddingInline:r,scrollPaddingInlineEnd:r,scrollPaddingInlineStart:r,fontSize:"fontSizes",background:t,backgroundColor:t,backgroundImage:t,borderImage:t,border:t,borderBlock:t,borderBlockEnd:t,borderBlockStart:t,borderBottom:t,borderBottomColor:t,borderColor:t,borderInline:t,borderInlineEnd:t,borderInlineStart:t,borderLeft:t,borderLeftColor:t,borderRight:t,borderRightColor:t,borderTop:t,borderTopColor:t,caretColor:t,color:t,columnRuleColor:t,fill:t,outline:t,outlineColor:t,stroke:t,textDecorationColor:t,fontFamily:"fonts",fontWeight:"fontWeights",lineHeight:"lineHeights",letterSpacing:"letterSpacings",blockSize:n,minBlockSize:n,maxBlockSize:n,inlineSize:n,minInlineSize:n,maxInlineSize:n,width:n,minWidth:n,maxWidth:n,height:n,minHeight:n,maxHeight:n,flexBasis:n,gridTemplateColumns:n,gridTemplateRows:n,borderWidth:"borderWidths",borderTopWidth:"borderWidths",borderRightWidth:"borderWidths",borderBottomWidth:"borderWidths",borderLeftWidth:"borderWidths",borderStyle:"borderStyles",borderTopStyle:"borderStyles",borderRightStyle:"borderStyles",borderBottomStyle:"borderStyles",borderLeftStyle:"borderStyles",borderRadius:"radii",borderTopLeftRadius:"radii",borderTopRightRadius:"radii",borderBottomRightRadius:"radii",borderBottomLeftRadius:"radii",boxShadow:"shadows",textShadow:"shadows",transition:"transitions",zIndex:"zIndices"},o=(e,t)=>"function"==typeof t?{"()":Function.prototype.toString.call(t)}:t,l=()=>{const e=Object.create(null);return (t,n,...r)=>{const i=(e=>JSON.stringify(e,o))(t);return i in e?e[i]:e[i]=n(t,...r)}},s=Symbol.for("sxs.internal"),a=(e,t)=>Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)),c=e=>{for(const t in e)return !0;return !1},{hasOwnProperty:d}=Object.prototype,g=e=>e.includes("-")?e:e.replace(/[A-Z]/g,(e=>"-"+e.toLowerCase())),p=/\s+(?![^()]*\))/,u=e=>t=>e(..."string"==typeof t?String(t).split(p):[t]),h={appearance:e=>({WebkitAppearance:e,appearance:e}),backfaceVisibility:e=>({WebkitBackfaceVisibility:e,backfaceVisibility:e}),backdropFilter:e=>({WebkitBackdropFilter:e,backdropFilter:e}),backgroundClip:e=>({WebkitBackgroundClip:e,backgroundClip:e}),boxDecorationBreak:e=>({WebkitBoxDecorationBreak:e,boxDecorationBreak:e}),clipPath:e=>({WebkitClipPath:e,clipPath:e}),content:e=>({content:e.includes('"')||e.includes("'")||/^([A-Za-z]+\([^]*|[^]*-quote|inherit|initial|none|normal|revert|unset)$/.test(e)?e:`"${e}"`}),hyphens:e=>({WebkitHyphens:e,hyphens:e}),maskImage:e=>({WebkitMaskImage:e,maskImage:e}),maskSize:e=>({WebkitMaskSize:e,maskSize:e}),tabSize:e=>({MozTabSize:e,tabSize:e}),textSizeAdjust:e=>({WebkitTextSizeAdjust:e,textSizeAdjust:e}),userSelect:e=>({WebkitUserSelect:e,userSelect:e}),marginBlock:u(((e,t)=>({marginBlockStart:e,marginBlockEnd:t||e}))),marginInline:u(((e,t)=>({marginInlineStart:e,marginInlineEnd:t||e}))),maxSize:u(((e,t)=>({maxBlockSize:e,maxInlineSize:t||e}))),minSize:u(((e,t)=>({minBlockSize:e,minInlineSize:t||e}))),paddingBlock:u(((e,t)=>({paddingBlockStart:e,paddingBlockEnd:t||e}))),paddingInline:u(((e,t)=>({paddingInlineStart:e,paddingInlineEnd:t||e})))},f=/([\d.]+)([^]*)/,m=(e,t)=>e.length?e.reduce(((e,n)=>(e.push(...t.map((e=>e.includes("&")?e.replace(/&/g,/[ +>|~]/.test(n)&&/&.*&/.test(e)?`:is(${n})`:n):n+" "+e))),e)),[]):t,b=(e,t)=>e in S&&"string"==typeof t?t.replace(/^((?:[^]*[^\w-])?)(fit-content|stretch)((?:[^\w-][^]*)?)$/,((t,n,r,i)=>n+("stretch"===r?`-moz-available${i};${g(e)}:${n}-webkit-fill-available`:`-moz-fit-content${i};${g(e)}:${n}fit-content`)+i)):String(t),S={blockSize:1,height:1,inlineSize:1,maxBlockSize:1,maxHeight:1,maxInlineSize:1,maxWidth:1,minBlockSize:1,minHeight:1,minInlineSize:1,minWidth:1,width:1},k=e=>e?e+"-":"",y=(e,t,n)=>e.replace(/([+-])?((?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)?(\$|--)([$\w-]+)/g,((e,r,i,o,l)=>"$"==o==!!i?e:(r||"--"==o?"calc(":"")+"var(--"+("$"===o?k(t)+(l.includes("$")?"":k(n))+l.replace(/\$/g,"-"):l)+")"+(r||"--"==o?"*"+(r||"")+(i||"1")+")":""))),B=/\s*,\s*(?![^()]*\))/,$=Object.prototype.toString,x=(e,t,n,r,i)=>{let o,l,s;const a=(e,t,n)=>{let c,d;const p=e=>{for(c in e){const x=64===c.charCodeAt(0),z=x&&Array.isArray(e[c])?e[c]:[e[c]];for(d of z){const e=/[A-Z]/.test(S=c)?S:S.replace(/-[^]/g,(e=>e[1].toUpperCase())),z="object"==typeof d&&d&&d.toString===$&&(!r.utils[e]||!t.length);if(e in r.utils&&!z){const t=r.utils[e];if(t!==l){l=t,p(t(d)),l=null;continue}}else if(e in h){const t=h[e];if(t!==s){s=t,p(t(d)),s=null;continue}}if(x&&(u=c.slice(1)in r.media?"@media "+r.media[c.slice(1)]:c,c=u.replace(/\(\s*([\w-]+)\s*(=|<|<=|>|>=)\s*([\w-]+)\s*(?:(<|<=|>|>=)\s*([\w-]+)\s*)?\)/g,((e,t,n,r,i,o)=>{const l=f.test(t),s=.0625*(l?-1:1),[a,c]=l?[r,t]:[t,r];return "("+("="===n[0]?"":">"===n[0]===l?"max-":"min-")+a+":"+("="!==n[0]&&1===n.length?c.replace(f,((e,t,r)=>Number(t)+s*(">"===n?1:-1)+r)):c)+(i?") and ("+(">"===i[0]?"min-":"max-")+a+":"+(1===i.length?o.replace(f,((e,t,n)=>Number(t)+s*(">"===i?-1:1)+n)):o):"")+")"}))),z){const e=x?n.concat(c):[...n],r=x?[...t]:m(t,c.split(B));void 0!==o&&i(I(...o)),o=void 0,a(d,r,e);}else void 0===o&&(o=[[],t,n]),c=x||36!==c.charCodeAt(0)?c:`--${k(r.prefix)}${c.slice(1).replace(/\$/g,"-")}`,d=z?d:"number"==typeof d?d&&e in R?String(d)+"px":String(d):y(b(e,null==d?"":d),r.prefix,r.themeMap[e]),o[0].push(`${x?`${c} `:`${g(c)}:`}${d}`);}}var u,S;};p(e),void 0!==o&&i(I(...o)),o=void 0;};a(e,t,n);},I=(e,t,n)=>`${n.map((e=>`${e}{`)).join("")}${t.length?`${t.join(",")}{`:""}${e.join(";")}${t.length?"}":""}${Array(n.length?n.length+1:0).join("}")}`,R={animationDelay:1,animationDuration:1,backgroundSize:1,blockSize:1,border:1,borderBlock:1,borderBlockEnd:1,borderBlockEndWidth:1,borderBlockStart:1,borderBlockStartWidth:1,borderBlockWidth:1,borderBottom:1,borderBottomLeftRadius:1,borderBottomRightRadius:1,borderBottomWidth:1,borderEndEndRadius:1,borderEndStartRadius:1,borderInlineEnd:1,borderInlineEndWidth:1,borderInlineStart:1,borderInlineStartWidth:1,borderInlineWidth:1,borderLeft:1,borderLeftWidth:1,borderRadius:1,borderRight:1,borderRightWidth:1,borderSpacing:1,borderStartEndRadius:1,borderStartStartRadius:1,borderTop:1,borderTopLeftRadius:1,borderTopRightRadius:1,borderTopWidth:1,borderWidth:1,bottom:1,columnGap:1,columnRule:1,columnRuleWidth:1,columnWidth:1,containIntrinsicSize:1,flexBasis:1,fontSize:1,gap:1,gridAutoColumns:1,gridAutoRows:1,gridTemplateColumns:1,gridTemplateRows:1,height:1,inlineSize:1,inset:1,insetBlock:1,insetBlockEnd:1,insetBlockStart:1,insetInline:1,insetInlineEnd:1,insetInlineStart:1,left:1,letterSpacing:1,margin:1,marginBlock:1,marginBlockEnd:1,marginBlockStart:1,marginBottom:1,marginInline:1,marginInlineEnd:1,marginInlineStart:1,marginLeft:1,marginRight:1,marginTop:1,maxBlockSize:1,maxHeight:1,maxInlineSize:1,maxWidth:1,minBlockSize:1,minHeight:1,minInlineSize:1,minWidth:1,offsetDistance:1,offsetRotate:1,outline:1,outlineOffset:1,outlineWidth:1,overflowClipMargin:1,padding:1,paddingBlock:1,paddingBlockEnd:1,paddingBlockStart:1,paddingBottom:1,paddingInline:1,paddingInlineEnd:1,paddingInlineStart:1,paddingLeft:1,paddingRight:1,paddingTop:1,perspective:1,right:1,rowGap:1,scrollMargin:1,scrollMarginBlock:1,scrollMarginBlockEnd:1,scrollMarginBlockStart:1,scrollMarginBottom:1,scrollMarginInline:1,scrollMarginInlineEnd:1,scrollMarginInlineStart:1,scrollMarginLeft:1,scrollMarginRight:1,scrollMarginTop:1,scrollPadding:1,scrollPaddingBlock:1,scrollPaddingBlockEnd:1,scrollPaddingBlockStart:1,scrollPaddingBottom:1,scrollPaddingInline:1,scrollPaddingInlineEnd:1,scrollPaddingInlineStart:1,scrollPaddingLeft:1,scrollPaddingRight:1,scrollPaddingTop:1,shapeMargin:1,textDecoration:1,textDecorationThickness:1,textIndent:1,textUnderlineOffset:1,top:1,transitionDelay:1,transitionDuration:1,verticalAlign:1,width:1,wordSpacing:1},z=e=>String.fromCharCode(e+(e>25?39:97)),W=e=>(e=>{let t,n="";for(t=Math.abs(e);t>52;t=t/52|0)n=z(t%52)+n;return z(t%52)+n})(((e,t)=>{let n=t.length;for(;n;)e=33*e^t.charCodeAt(--n);return e})(5381,JSON.stringify(e))>>>0),j=["themed","global","styled","onevar","resonevar","allvar","inline"],E=e=>{if(e.href&&!e.href.startsWith(location.origin))return !1;try{return !!e.cssRules}catch(e){return !1}},T=e=>{let t;const n=()=>{const{cssRules:e}=t.sheet;return [].map.call(e,((n,r)=>{const{cssText:i}=n;let o="";if(i.startsWith("--sxs"))return "";if(e[r-1]&&(o=e[r-1].cssText).startsWith("--sxs")){if(!n.cssRules.length)return "";for(const e in t.rules)if(t.rules[e].group===n)return `--sxs{--sxs:${[...t.rules[e].cache].join(" ")}}${i}`;return n.cssRules.length?`${o}${i}`:""}return i})).join("")},r=()=>{if(t){const{rules:e,sheet:n}=t;if(!n.deleteRule){for(;3===Object(Object(n.cssRules)[0]).type;)n.cssRules.splice(0,1);n.cssRules=[];}for(const t in e)delete e[t];}const i=Object(e).styleSheets||[];for(const e of i)if(E(e)){for(let i=0,o=e.cssRules;o[i];++i){const l=Object(o[i]);if(1!==l.type)continue;const s=Object(o[i+1]);if(4!==s.type)continue;++i;const{cssText:a}=l;if(!a.startsWith("--sxs"))continue;const c=a.slice(14,-3).trim().split(/\s+/),d=j[c[0]];d&&(t||(t={sheet:e,reset:r,rules:{},toString:n}),t.rules[d]={group:s,index:i,cache:new Set(c)});}if(t)break}if(!t){const i=(e,t)=>({type:t,cssRules:[],insertRule(e,t){this.cssRules.splice(t,0,i(e,{import:3,undefined:1}[(e.toLowerCase().match(/^@([a-z]+)/)||[])[1]]||4));},get cssText(){return "@media{}"===e?`@media{${[].map.call(this.cssRules,(e=>e.cssText)).join("")}}`:e}});t={sheet:e?(e.head||e).appendChild(document.createElement("style")).sheet:i("","text/css"),rules:{},reset:r,toString:n};}const{sheet:o,rules:l}=t;for(let e=j.length-1;e>=0;--e){const t=j[e];if(!l[t]){const n=j[e+1],r=l[n]?l[n].index:o.cssRules.length;o.insertRule("@media{}",r),o.insertRule(`--sxs{--sxs:${e}}`,r),l[t]={group:o.cssRules[r+1],index:r,cache:new Set([e])};}v(l[t]);}};return r(),t},v=e=>{const t=e.group;let n=t.cssRules.length;e.apply=e=>{try{t.insertRule(e,n),++n;}catch(e){}};},M=Symbol(),w=l(),C=(e,t)=>w(e,(()=>(...n)=>{let r={type:null,composers:new Set};for(const t of n)if(null!=t)if(t[s]){null==r.type&&(r.type=t[s].type);for(const e of t[s].composers)r.composers.add(e);}else t.constructor!==Object||t.$$typeof?null==r.type&&(r.type=t):r.composers.add(P(t,e));return null==r.type&&(r.type="span"),r.composers.size||r.composers.add(["PJLV",{},[],[],{},[]]),L(e,r,t)})),P=({variants:e,compoundVariants:t,defaultVariants:n,...r},i)=>{const o=`${k(i.prefix)}c-${W(r)}`,l=[],s=[],a=Object.create(null),g=[];for(const e in n)a[e]=String(n[e]);if("object"==typeof e&&e)for(const t in e){p=a,u=t,d.call(p,u)||(a[t]="undefined");const n=e[t];for(const e in n){const r={[t]:String(e)};"undefined"===String(e)&&g.push(t);const i=n[e],o=[r,i,!c(i)];l.push(o);}}var p,u;if("object"==typeof t&&t)for(const e of t){let{css:t,...n}=e;t="object"==typeof t&&t||{};for(const e in n)n[e]=String(n[e]);const r=[n,t,!c(t)];s.push(r);}return [o,r,l,s,a,g]},L=(e,t,n)=>{const[r,i,o,l]=O(t.composers),c="function"==typeof t.type||t.type.$$typeof?(e=>{function t(){for(let n=0;n<t[M].length;n++){const[r,i]=t[M][n];e.rules[r].apply(i);}return t[M]=[],null}return t[M]=[],t.rules={},j.forEach((e=>t.rules[e]={apply:n=>t[M].push([e,n])})),t})(n):null,d=(c||n).rules,g=`.${r}${i.length>1?`:where(.${i.slice(1).join(".")})`:""}`,p=s=>{s="object"==typeof s&&s||D;const{css:a,...p}=s,u={};for(const e in o)if(delete p[e],e in s){let t=s[e];"object"==typeof t&&t?u[e]={"@initial":o[e],...t}:(t=String(t),u[e]="undefined"!==t||l.has(e)?t:o[e]);}else u[e]=o[e];const h=new Set([...i]);for(const[r,i,o,l]of t.composers){n.rules.styled.cache.has(r)||(n.rules.styled.cache.add(r),x(i,[`.${r}`],[],e,(e=>{d.styled.apply(e);})));const t=A(o,u,e.media),s=A(l,u,e.media,!0);for(const i of t)if(void 0!==i)for(const[t,o,l]of i){const i=`${r}-${W(o)}-${t}`;h.add(i);const s=(l?n.rules.resonevar:n.rules.onevar).cache,a=l?d.resonevar:d.onevar;s.has(i)||(s.add(i),x(o,[`.${i}`],[],e,(e=>{a.apply(e);})));}for(const t of s)if(void 0!==t)for(const[i,o]of t){const t=`${r}-${W(o)}-${i}`;h.add(t),n.rules.allvar.cache.has(t)||(n.rules.allvar.cache.add(t),x(o,[`.${t}`],[],e,(e=>{d.allvar.apply(e);})));}}if("object"==typeof a&&a){const t=`${r}-i${W(a)}-css`;h.add(t),n.rules.inline.cache.has(t)||(n.rules.inline.cache.add(t),x(a,[`.${t}`],[],e,(e=>{d.inline.apply(e);})));}for(const e of String(s.className||"").trim().split(/\s+/))e&&h.add(e);const f=p.className=[...h].join(" ");return {type:t.type,className:f,selector:g,props:p,toString:()=>f,deferredInjector:c}};return a(p,{className:r,selector:g,[s]:t,toString:()=>(n.rules.styled.cache.has(r)||p(),r)})},O=e=>{let t="";const n=[],r={},i=[];for(const[o,,,,l,s]of e){""===t&&(t=o),n.push(o),i.push(...s);for(const e in l){const t=l[e];(void 0===r[e]||"undefined"!==t||s.includes(t))&&(r[e]=t);}}return [t,n,r,new Set(i)]},A=(e,t,n,r)=>{const i=[];e:for(let[o,l,s]of e){if(s)continue;let e,a=0,c=!1;for(e in o){const r=o[e];let i=t[e];if(i!==r){if("object"!=typeof i||!i)continue e;{let e,t,o=0;for(const l in i){if(r===String(i[l])){if("@initial"!==l){const e=l.slice(1);(t=t||[]).push(e in n?n[e]:l.replace(/^@media ?/,"")),c=!0;}a+=o,e=!0;}++o;}if(t&&t.length&&(l={["@media "+t.join(", ")]:l}),!e)continue e}}}(i[a]=i[a]||[]).push([r?"cv":`${e}-${o[e]}`,l,c]);}return i},D={},H=l(),N=(e,t)=>H(e,(()=>(...n)=>{const r=()=>{for(let r of n){r="object"==typeof r&&r||{};let n=W(r);if(!t.rules.global.cache.has(n)){if(t.rules.global.cache.add(n),"@import"in r){let e=[].indexOf.call(t.sheet.cssRules,t.rules.themed.group)-1;for(let n of [].concat(r["@import"]))n=n.includes('"')||n.includes("'")?n:`"${n}"`,t.sheet.insertRule(`@import ${n};`,e++);delete r["@import"];}x(r,[],[],e,(e=>{t.rules.global.apply(e);}));}}return ""};return a(r,{toString:r})})),V=l(),G=(e,t)=>V(e,(()=>n=>{const r=`${k(e.prefix)}k-${W(n)}`,i=()=>{if(!t.rules.global.cache.has(r)){t.rules.global.cache.add(r);const i=[];x(n,[],[],e,(e=>i.push(e)));const o=`@keyframes ${r}{${i.join("")}}`;t.rules.global.apply(o);}return r};return a(i,{get name(){return i()},toString:i})})),F=class{constructor(e,t,n,r){this.token=null==e?"":String(e),this.value=null==t?"":String(t),this.scale=null==n?"":String(n),this.prefix=null==r?"":String(r);}get computedValue(){return "var("+this.variable+")"}get variable(){return "--"+k(this.prefix)+k(this.scale)+this.token}toString(){return this.computedValue}},J=l(),U=(e,t)=>J(e,(()=>(n,r)=>{r="object"==typeof n&&n||Object(r);const i=`.${n=(n="string"==typeof n?n:"")||`${k(e.prefix)}t-${W(r)}`}`,o={},l=[];for(const t in r){o[t]={};for(const n in r[t]){const i=`--${k(e.prefix)}${t}-${n}`,s=y(String(r[t][n]),e.prefix,t);o[t][n]=new F(n,s,t,e.prefix),l.push(`${i}:${s}`);}}const s=()=>{if(l.length&&!t.rules.themed.cache.has(n)){t.rules.themed.cache.add(n);const i=`${r===e.theme?":root,":""}.${n}{${l.join(";")}}`;t.rules.themed.apply(i);}return n};return {...o,get className(){return s()},selector:i,toString:s}})),Z=l(),X=e=>{let t=!1;const n=Z(e,(e=>{t=!0;const n="prefix"in(e="object"==typeof e&&e||{})?String(e.prefix):"",r="object"==typeof e.media&&e.media||{},o="object"==typeof e.root?e.root||null:globalThis.document||null,l="object"==typeof e.theme&&e.theme||{},s={prefix:n,media:r,theme:l,themeMap:"object"==typeof e.themeMap&&e.themeMap||{...i},utils:"object"==typeof e.utils&&e.utils||{}},a=T(o),c={css:C(s,a),globalCss:N(s,a),keyframes:G(s,a),createTheme:U(s,a),reset(){a.reset(),c.theme.toString();},theme:{},sheet:a,config:s,prefix:n,getCssText:a.toString,toString:a.toString};return String(c.theme=c.createTheme(l)),c}));return t||n.reset(),n};//# sourceMappingUrl=index.map

	const colors = {
	    primary: '#228be6',
	    white: '#ffffff',
	    black: '#000000',
	    dark50: '#C1C2C5',
	    dark100: '#A6A7AB',
	    dark200: '#909296',
	    dark300: '#5c5f66',
	    dark400: '#373A40',
	    dark500: '#2C2E33',
	    dark600: '#25262b',
	    dark700: '#1A1B1E',
	    dark800: '#141517',
	    dark900: '#101113',
	    gray50: '#f8f9fa',
	    gray100: '#f1f3f5',
	    gray200: '#e9ecef',
	    gray300: '#dee2e6',
	    gray400: '#ced4da',
	    gray500: '#adb5bd',
	    gray600: '#868e96',
	    gray700: '#495057',
	    gray800: '#343a40',
	    gray900: '#212529',
	    red50: '#fff5f5',
	    red100: '#ffe3e3',
	    red200: '#ffc9c9',
	    red300: '#ffa8a8',
	    red400: '#ff8787',
	    red500: '#ff6b6b',
	    red600: '#fa5252',
	    red700: '#f03e3e',
	    red800: '#e03131',
	    red900: '#c92a2a',
	    pink50: '#fff0f6',
	    pink100: '#ffdeeb',
	    pink200: '#fcc2d7',
	    pink300: '#faa2c1',
	    pink400: '#f783ac',
	    pink500: '#f06595',
	    pink600: '#e64980',
	    pink700: '#d6336c',
	    pink800: '#c2255c',
	    pink900: '#a61e4d',
	    grape50: '#f8f0fc',
	    grape100: '#f3d9fa',
	    grape200: '#eebefa',
	    grape300: '#e599f7',
	    grape400: '#da77f2',
	    grape500: '#cc5de8',
	    grape600: '#be4bdb',
	    grape700: '#ae3ec9',
	    grape800: '#9c36b5',
	    grape900: '#862e9c',
	    violet50: '#f3f0ff',
	    violet100: '#e5dbff',
	    violet200: '#d0bfff',
	    violet300: '#b197fc',
	    violet400: '#9775fa',
	    violet500: '#845ef7',
	    violet600: '#7950f2',
	    violet700: '#7048e8',
	    violet800: '#6741d9',
	    violet900: '#5f3dc4',
	    indigo50: '#edf2ff',
	    indigo100: '#dbe4ff',
	    indigo200: '#bac8ff',
	    indigo300: '#91a7ff',
	    indigo400: '#748ffc',
	    indigo500: '#5c7cfa',
	    indigo600: '#4c6ef5',
	    indigo700: '#4263eb',
	    indigo800: '#3b5bdb',
	    indigo900: '#364fc7',
	    blue50: '#e7f5ff',
	    blue100: '#d0ebff',
	    blue200: '#a5d8ff',
	    blue300: '#74c0fc',
	    blue400: '#4dabf7',
	    blue500: '#339af0',
	    blue600: '#228be6',
	    blue700: '#1c7ed6',
	    blue800: '#1971c2',
	    blue900: '#1864ab',
	    cyan50: '#e3fafc',
	    cyan100: '#c5f6fa',
	    cyan200: '#99e9f2',
	    cyan300: '#66d9e8',
	    cyan400: '#3bc9db',
	    cyan500: '#22b8cf',
	    cyan600: '#15aabf',
	    cyan700: '#1098ad',
	    cyan800: '#0c8599',
	    cyan900: '#0b7285',
	    teal50: '#e6fcf5',
	    teal100: '#c3fae8',
	    teal200: '#96f2d7',
	    teal300: '#63e6be',
	    teal400: '#38d9a9',
	    teal500: '#20c997',
	    teal600: '#12b886',
	    teal700: '#0ca678',
	    teal800: '#099268',
	    teal900: '#087f5b',
	    green50: '#ebfbee',
	    green100: '#d3f9d8',
	    green200: '#b2f2bb',
	    green300: '#8ce99a',
	    green400: '#69db7c',
	    green500: '#51cf66',
	    green600: '#40c057',
	    green700: '#37b24d',
	    green800: '#2f9e44',
	    green900: '#2b8a3e',
	    lime50: '#f4fce3',
	    lime100: '#e9fac8',
	    lime200: '#d8f5a2',
	    lime300: '#c0eb75',
	    lime400: '#a9e34b',
	    lime500: '#94d82d',
	    lime600: '#82c91e',
	    lime700: '#74b816',
	    lime800: '#66a80f',
	    lime900: '#5c940d',
	    yellow50: '#fff9db',
	    yellow100: '#fff3bf',
	    yellow200: '#ffec99',
	    yellow300: '#ffe066',
	    yellow400: '#ffd43b',
	    yellow500: '#fcc419',
	    yellow600: '#fab005',
	    yellow700: '#f59f00',
	    yellow800: '#f08c00',
	    yellow900: '#e67700',
	    orange50: '#fff4e6',
	    orange100: '#ffe8cc',
	    orange200: '#ffd8a8',
	    orange300: '#ffc078',
	    orange400: '#ffa94d',
	    orange500: '#ff922b',
	    orange600: '#fd7e14',
	    orange700: '#f76707',
	    orange800: '#e8590c',
	    orange900: '#d9480f'
	};
	const colorNameMap = {
	    blue: 'blue',
	    cyan: 'cyan',
	    dark: 'dark',
	    grape: 'grape',
	    gray: 'gray',
	    green: 'green',
	    indigo: 'indigo',
	    lime: 'lime',
	    orange: 'orange',
	    pink: 'pink',
	    red: 'red',
	    teal: 'teal',
	    violet: 'violet',
	    yellow: 'yellow'
	};

	const { css, globalCss, keyframes, getCssText, theme, createTheme, config, reset } = X({
	    prefix: 'svelteui',
	    theme: {
	        colors,
	        space: {
	            0: '0rem',
	            xs: 10,
	            sm: 12,
	            md: 16,
	            lg: 20,
	            xl: 24,
	            xsPX: '10px',
	            smPX: '12px',
	            mdPX: '16px',
	            lgPX: '20px',
	            xlPX: '24px',
	            1: '0.125rem',
	            2: '0.25rem',
	            3: '0.375rem',
	            4: '0.5rem',
	            5: '0.625rem',
	            6: '0.75rem',
	            7: '0.875rem',
	            8: '1rem',
	            9: '1.25rem',
	            10: '1.5rem',
	            11: '1.75rem',
	            12: '2rem',
	            13: '2.25rem',
	            14: '2.5rem',
	            15: '2.75rem',
	            16: '3rem',
	            17: '3.5rem',
	            18: '4rem',
	            20: '5rem',
	            24: '6rem',
	            28: '7rem',
	            32: '8rem',
	            36: '9rem',
	            40: '10rem',
	            44: '11rem',
	            48: '12rem',
	            52: '13rem',
	            56: '14rem',
	            60: '15rem',
	            64: '16rem',
	            72: '18rem',
	            80: '20rem',
	            96: '24rem'
	        },
	        fontSizes: {
	            xs: '12px',
	            sm: '14px',
	            md: '16px',
	            lg: '18px',
	            xl: '20px'
	        },
	        fonts: {
	            standard: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji',
	            mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
	            fallback: 'Segoe UI, system-ui, sans-serif'
	        },
	        fontWeights: {
	            thin: 100,
	            extralight: 200,
	            light: 300,
	            normal: 400,
	            medium: 500,
	            semibold: 600,
	            bold: 700,
	            extrabold: 800
	        },
	        lineHeights: {
	            xs: 1,
	            sm: 1.25,
	            md: 1.5,
	            lg: 1.625,
	            xl: 1.75
	        },
	        letterSpacings: {
	            tighter: '-0.05em',
	            tight: '-0.025em',
	            normal: '0',
	            wide: '0.025em',
	            wider: '0.05em',
	            widest: '0.1em'
	        },
	        sizes: {},
	        radii: {
	            xs: '2px',
	            sm: '4px',
	            md: '8px',
	            lg: '16px',
	            xl: '32px',
	            squared: '33%',
	            rounded: '50%',
	            pill: '9999px'
	        },
	        shadows: {
	            xs: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
	            sm: '0 1px 3px rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0px 10px 15px -5px, rgba(0, 0, 0, 0.04) 0px 7px 7px -5px',
	            md: '0 1px 3px rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0px 20px 25px -5px, rgba(0, 0, 0, 0.04) 0px 10px 10px -5px',
	            lg: '0 1px 3px rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0px 28px 23px -7px, rgba(0, 0, 0, 0.04) 0px 12px 12px -7px',
	            xl: '0 1px 3px rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.05) 0px 36px 28px -7px, rgba(0, 0, 0, 0.04) 0px 17px 17px -7px'
	        },
	        zIndices: {
	            1: '100',
	            2: '200',
	            3: '300',
	            4: '400',
	            5: '500',
	            10: '1000',
	            max: '9999'
	        },
	        borderWidths: {
	            light: '1px',
	            normal: '2px',
	            bold: '3px',
	            extrabold: '4px',
	            black: '5px',
	            xs: '1px',
	            sm: '2px',
	            md: '3px',
	            lg: '4px',
	            xl: '5px'
	        },
	        breakpoints: {
	            xs: 576,
	            sm: 768,
	            md: 992,
	            lg: 1200,
	            xl: 1400
	        },
	        borderStyles: {},
	        transitions: {}
	    },
	    media: {
	        xs: '(min-width: 576px)',
	        sm: '(min-width: 768px)',
	        md: '(min-width: 992px)',
	        lg: '(min-width: 1200px)',
	        xl: '(min-width: 1400px)'
	    },
	    utils: {
	        focusRing: (value) => ({
	            WebkitTapHighlightColor: 'transparent',
	            '&:focus': {
	                outlineOffset: 2,
	                outline: value === 'always' || value === 'auto' ? '2px solid $primary' : 'none'
	            },
	            '&:focus:not(:focus-visible)': {
	                outline: value === 'auto' || value === 'never' ? 'none' : undefined
	            }
	        }),
	        /** padding top */
	        p: (value) => ({
	            padding: value
	        }),
	        pt: (value) => ({
	            paddingTop: value
	        }),
	        pr: (value) => ({
	            paddingRight: value
	        }),
	        pb: (value) => ({
	            paddingBottom: value
	        }),
	        pl: (value) => ({
	            paddingLeft: value
	        }),
	        px: (value) => ({
	            paddingLeft: value,
	            paddingRight: value
	        }),
	        py: (value) => ({
	            paddingTop: value,
	            paddingBottom: value
	        }),
	        /** margin */
	        m: (value) => ({
	            margin: value
	        }),
	        /** margin-top */
	        mt: (value) => ({
	            marginTop: value
	        }),
	        mr: (value) => ({
	            marginRight: value
	        }),
	        mb: (value) => ({
	            marginBottom: value
	        }),
	        ml: (value) => ({
	            marginLeft: value
	        }),
	        mx: (value) => ({
	            marginLeft: value,
	            marginRight: value
	        }),
	        my: (value) => ({
	            marginTop: value,
	            marginBottom: value
	        }),
	        ta: (value) => ({
	            textAlign: value
	        }),
	        tt: (value) => ({
	            textTransform: value
	        }),
	        to: (value) => ({
	            textOverflow: value
	        }),
	        d: (value) => ({ display: value }),
	        dflex: (value) => ({
	            display: 'flex',
	            alignItems: value,
	            justifyContent: value
	        }),
	        fd: (value) => ({
	            flexDirection: value
	        }),
	        fw: (value) => ({ flexWrap: value }),
	        ai: (value) => ({
	            alignItems: value
	        }),
	        ac: (value) => ({
	            alignContent: value
	        }),
	        jc: (value) => ({
	            justifyContent: value
	        }),
	        as: (value) => ({
	            alignSelf: value
	        }),
	        fg: (value) => ({ flexGrow: value }),
	        fs: (value) => ({
	            fontSize: value
	        }),
	        fb: (value) => ({
	            flexBasis: value
	        }),
	        bc: (value) => ({
	            backgroundColor: value
	        }),
	        bf: (value) => ({
	            backdropFilter: value
	        }),
	        bg: (value) => ({
	            background: value
	        }),
	        bgBlur: (value) => ({
	            bf: 'saturate(180%) blur(10px)',
	            bg: value
	        }),
	        bgColor: (value) => ({
	            backgroundColor: value
	        }),
	        backgroundClip: (value) => ({
	            WebkitBackgroundClip: value,
	            backgroundClip: value
	        }),
	        bgClip: (value) => ({
	            WebkitBackgroundClip: value,
	            backgroundClip: value
	        }),
	        br: (value) => ({
	            borderRadius: value
	        }),
	        bw: (value) => ({
	            borderWidth: value
	        }),
	        btrr: (value) => ({
	            borderTopRightRadius: value
	        }),
	        bbrr: (value) => ({
	            borderBottomRightRadius: value
	        }),
	        bblr: (value) => ({
	            borderBottomLeftRadius: value
	        }),
	        btlr: (value) => ({
	            borderTopLeftRadius: value
	        }),
	        bs: (value) => ({
	            boxShadow: value
	        }),
	        normalShadow: (value) => ({
	            boxShadow: `0 4px 14px 0 $${value}`
	        }),
	        lh: (value) => ({
	            lineHeight: value
	        }),
	        ov: (value) => ({ overflow: value }),
	        ox: (value) => ({
	            overflowX: value
	        }),
	        oy: (value) => ({
	            overflowY: value
	        }),
	        pe: (value) => ({
	            pointerEvents: value
	        }),
	        events: (value) => ({
	            pointerEvents: value
	        }),
	        us: (value) => ({
	            WebkitUserSelect: value,
	            userSelect: value
	        }),
	        userSelect: (value) => ({
	            WebkitUserSelect: value,
	            userSelect: value
	        }),
	        w: (value) => ({ width: value }),
	        h: (value) => ({
	            height: value
	        }),
	        minW: (value) => ({
	            minWidth: value
	        }),
	        minH: (value) => ({
	            minWidth: value
	        }),
	        mw: (value) => ({
	            maxWidth: value
	        }),
	        maxW: (value) => ({
	            maxWidth: value
	        }),
	        mh: (value) => ({
	            maxHeight: value
	        }),
	        maxH: (value) => ({
	            maxHeight: value
	        }),
	        size: (value) => ({
	            width: value,
	            height: value
	        }),
	        minSize: (value) => ({
	            minWidth: value,
	            minHeight: value,
	            width: value,
	            height: value
	        }),
	        sizeMin: (value) => ({
	            minWidth: value,
	            minHeight: value,
	            width: value,
	            height: value
	        }),
	        maxSize: (value) => ({
	            maxWidth: value,
	            maxHeight: value
	        }),
	        sizeMax: (value) => ({
	            maxWidth: value,
	            maxHeight: value
	        }),
	        appearance: (value) => ({
	            WebkitAppearance: value,
	            appearance: value
	        }),
	        scale: (value) => ({
	            transform: `scale(${value})`
	        }),
	        linearGradient: (value) => ({
	            backgroundImage: `linear-gradient(${value})`
	        }),
	        tdl: (value) => ({
	            textDecorationLine: value
	        }),
	        // Text gradient effect
	        textGradient: (value) => ({
	            backgroundImage: `linear-gradient(${value})`,
	            WebkitBackgroundClip: 'text',
	            WebkitTextFillColor: 'transparent'
	        })
	    },
	    themeMap: {
	        ...i,
	        width: 'space',
	        height: 'space',
	        minWidth: 'space',
	        maxWidth: 'space',
	        minHeight: 'space',
	        maxHeight: 'space',
	        flexBasis: 'space',
	        gridTemplateColumns: 'space',
	        gridTemplateRows: 'space',
	        blockSize: 'space',
	        minBlockSize: 'space',
	        maxBlockSize: 'space',
	        inlineSize: 'space',
	        minInlineSize: 'space',
	        maxInlineSize: 'space',
	        borderWidth: 'borderWeights'
	    }
	});
	/** Function for dark theme */
	const dark = createTheme('dark-theme', {
	    colors,
	    shadows: {
	        xs: '-4px 0 15px rgb(0 0 0 / 50%)',
	        sm: '0 5px 20px -5px rgba(20, 20, 20, 0.1)',
	        md: '0 8px 30px rgba(20, 20, 20, 0.15)',
	        lg: '0 30px 60px rgba(20, 20, 20, 0.15)',
	        xl: '0 40px 80px rgba(20, 20, 20, 0.25)'
	    }
	});
	/** Global styles for SvelteUI */
	globalCss({
	    a: {
	        focusRing: 'auto'
	    },
	    body: {
	        [`${dark.selector} &`]: {
	            backgroundColor: '$dark700',
	            color: '$dark50'
	        },
	        backgroundColor: '$white',
	        color: '$black'
	    }
	});
	/** Normalize css function */
	globalCss({
	    html: {
	        fontFamily: 'sans-serif',
	        lineHeight: '1.15',
	        textSizeAdjust: '100%',
	        margin: 0
	    },
	    body: {
	        margin: 0
	    },
	    'article, aside, footer, header, nav, section, figcaption, figure, main': {
	        display: 'block'
	    },
	    h1: {
	        fontSize: '2em',
	        margin: 0
	    },
	    hr: {
	        boxSizing: 'content-box',
	        height: 0,
	        overflow: 'visible'
	    },
	    pre: {
	        fontFamily: 'monospace, monospace',
	        fontSize: '1em'
	    },
	    a: {
	        background: 'transparent',
	        textDecorationSkip: 'objects'
	    },
	    'a:active, a:hover': {
	        outlineWidth: 0
	    },
	    'abbr[title]': {
	        borderBottom: 'none',
	        textDecoration: 'underline'
	    },
	    'b, strong': {
	        fontWeight: 'bolder'
	    },
	    'code, kbp, samp': {
	        fontFamily: 'monospace, monospace',
	        fontSize: '1em'
	    },
	    dfn: {
	        fontStyle: 'italic'
	    },
	    mark: {
	        backgroundColor: '#ff0',
	        color: '#000'
	    },
	    small: {
	        fontSize: '80%'
	    },
	    'sub, sup': {
	        fontSize: '75%',
	        lineHeight: 0,
	        position: 'relative',
	        verticalAlign: 'baseline'
	    },
	    sup: {
	        top: '-0.5em'
	    },
	    sub: {
	        bottom: '-0.25em'
	    },
	    'audio, video': {
	        display: 'inline-block'
	    },
	    'audio:not([controls])': {
	        display: 'none',
	        height: 0
	    },
	    img: {
	        borderStyle: 'none',
	        verticalAlign: 'middle'
	    },
	    'svg:not(:root)': {
	        overflow: 'hidden'
	    },
	    'button, input, optgroup, select, textarea': {
	        fontFamily: 'sans-serif',
	        fontSize: '100%',
	        lineHeight: '1.15',
	        margin: 0
	    },
	    'button, input': {
	        overflow: 'visible'
	    },
	    'button, select': {
	        textTransform: 'none'
	    },
	    'button, [type=reset], [type=submit]': {
	        WebkitAppearance: 'button'
	    },
	    'button::-moz-focus-inner, [type=button]::-moz-focus-inner, [type=reset]::-moz-focus-inner, [type=submit]::-moz-focus-inner': {
	        borderStyle: 'none',
	        padding: 0
	    },
	    'button:-moz-focusring, [type=button]:-moz-focusring, [type=reset]:-moz-focusring, [type=submit]:-moz-focusring': {
	        outline: '1px dotted ButtonText'
	    },
	    legend: {
	        boxSizing: 'border-box',
	        color: 'inherit',
	        display: 'table',
	        maxWidth: '100%',
	        padding: 0,
	        whiteSpace: 'normal'
	    },
	    progress: {
	        display: 'inline-block',
	        verticalAlign: 'baseline'
	    },
	    textarea: {
	        overflow: 'auto'
	    },
	    '[type=checkbox], [type=radio]': {
	        boxSizing: 'border-box',
	        padding: 0
	    },
	    '[type=number]::-webkit-inner-spin-button, [type=number]::-webkit-outer-spin-button': {
	        height: 'auto'
	    },
	    '[type=search]': {
	        appearance: 'textfield',
	        outlineOffset: '-2px'
	    },
	    '[type=search]::-webkit-search-cancel-button, [type=search]::-webkit-search-decoration': {
	        appearance: 'none'
	    },
	    '::-webkit-file-upload-button': {
	        appearance: 'button',
	        font: 'inherit'
	    },
	    'details, menu': {
	        display: 'block'
	    },
	    summary: {
	        display: 'list-item'
	    },
	    canvas: {
	        display: 'inline-block'
	    },
	    template: {
	        display: 'none'
	    },
	    '[hidden]': {
	        display: 'none'
	    }
	});

	function themeColor(color, shade = 0) {
	    const theme = useSvelteUIThemeContext()?.theme || useSvelteUITheme();
	    let _shade = '50';
	    if (!isSvelteUIColor(color))
	        return color;
	    if (shade !== Number(0))
	        _shade = `${shade.toString()}00`;
	    return theme.colors[`${color}${_shade}`]?.value;
	}
	function isSvelteUIColor(color) {
	    let valid = false;
	    switch (color) {
	        case 'dark':
	            valid = true;
	            break;
	        case 'gray':
	            valid = true;
	            break;
	        case 'red':
	            valid = true;
	            break;
	        case 'pink':
	            valid = true;
	            break;
	        case 'grape':
	            valid = true;
	            break;
	        case 'violet':
	            valid = true;
	            break;
	        case 'indigo':
	            valid = true;
	            break;
	        case 'blue':
	            valid = true;
	            break;
	        case 'cyan':
	            valid = true;
	            break;
	        case 'teal':
	            valid = true;
	            break;
	        case 'green':
	            valid = true;
	            break;
	        case 'lime':
	            valid = true;
	            break;
	        case 'yellow':
	            valid = true;
	            break;
	        case 'orange':
	            valid = true;
	            break;
	        default:
	            valid = false;
	            break;
	    }
	    return valid;
	}

	function createConverter(units) {
	    return (px) => {
	        if (typeof px === 'number') {
	            return `${px / 16}${units}`;
	        }
	        if (typeof px === 'string') {
	            const replaced = px.replace('px', '');
	            if (!Number.isNaN(Number(replaced))) {
	                return `${Number(replaced) / 16}${units}`;
	            }
	        }
	        return px;
	    };
	}
	const rem = createConverter('rem');

	function cover(offset = 0) {
	    return {
	        position: 'absolute',
	        top: rem(offset),
	        right: rem(offset),
	        left: rem(offset),
	        bottom: rem(offset)
	    };
	}

	function size(props) {
	    if (typeof props.size === 'number') {
	        return props.size;
	    }
	    if (typeof props.sizes[props.size] === 'number') {
	        return props.sizes[props.size];
	    }
	    return +props.sizes[props.size]?.value || +props.sizes.md?.value;
	}

	function radius(radii) {
	    const theme = useSvelteUIThemeContext()?.theme || useSvelteUITheme();
	    if (typeof radii === 'number') {
	        return radii;
	    }
	    return theme.radii[radii].value;
	}

	function isHexColor(hex) {
	    const replaced = hex.replace('#', '');
	    return (typeof replaced === 'string' && replaced.length === 6 && !Number.isNaN(Number(`0x${replaced}`)));
	}
	function hexToRgba(color) {
	    const replaced = color.replace('#', '');
	    const parsed = parseInt(replaced, 16);
	    const r = (parsed >> 16) & 255;
	    const g = (parsed >> 8) & 255;
	    const b = parsed & 255;
	    return {
	        r,
	        g,
	        b,
	        a: 1
	    };
	}
	function rgbStringToRgba(color) {
	    const [r, g, b, a] = color
	        .replace(/[^0-9,.]/g, '')
	        .split(',')
	        .map(Number);
	    return { r, g, b, a: a || 1 };
	}
	function toRgba(color) {
	    if (isHexColor(color)) {
	        return hexToRgba(color);
	    }
	    if (color.startsWith('rgb')) {
	        return rgbStringToRgba(color);
	    }
	    return {
	        r: 0,
	        g: 0,
	        b: 0,
	        a: 1
	    };
	}

	function rgba(color, alpha = 1) {
	    if (typeof color !== 'string' || alpha > 1 || alpha < 0) {
	        return 'rgba(0, 0, 0, 1)';
	    }
	    const { r, g, b } = toRgba(color);
	    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	const DEFAULT_GRADIENT = {
	    from: 'indigo',
	    to: 'cyan',
	    deg: 45
	};
	/**
	 * THe Variant function is a function that takes a variant, optional color/gradient and returns the desired styles for four specific properties.
	 *
	 * Some styles will return tuples of strings where the first value is the dark version of the specific style, and the second value is the light version.
	 *
	 * @param VariantInput - an object that has a variant, color, and optional gradient property
	 * @returns an object with border, background, color, and hover property styles based on the variant
	 */
	function variant({ variant, color, gradient }) {
	    const theme = useSvelteUIThemeContext()?.theme || useSvelteUITheme();
	    const primaryShade = 6;
	    if (variant === 'light') {
	        return {
	            border: 'transparent',
	            background: [rgba(themeColor(color, 8), 0.35), rgba(themeColor(color, 0), 1)],
	            color: [
	                color === 'dark' ? themeColor('dark', 0) : themeColor(color, 2),
	                color === 'dark' ? themeColor('dark', 9) : themeColor(color, primaryShade)
	            ],
	            // themeColor(color, theme.colorScheme === 'dark' ? 2 : getPrimaryShade('light')),
	            hover: [rgba(themeColor(color, 7), 0.45), rgba(themeColor(color, 1), 0.65)]
	        };
	    }
	    if (variant === 'default') {
	        return {
	            border: [themeColor('dark', 5), themeColor('gray', 4)],
	            background: [themeColor('dark', 5), theme.colors.white.value],
	            color: [theme.colors.white.value, theme.colors.black.value],
	            hover: [themeColor('dark', 4), themeColor('gray', 0)]
	        };
	    }
	    if (variant === 'white') {
	        return {
	            border: 'transparent',
	            background: theme.colors.white.value,
	            color: themeColor(color, primaryShade),
	            hover: null
	        };
	    }
	    if (variant === 'outline') {
	        return {
	            border: [themeColor(color, 4), themeColor(color, primaryShade)],
	            background: 'transparent',
	            color: [themeColor(color, 4), themeColor(color, primaryShade)],
	            hover: [rgba(themeColor(color, 4), 0.05), rgba(themeColor(color, 0), 0.35)]
	        };
	    }
	    if (variant === 'gradient') {
	        const merged = {
	            from: gradient?.from || DEFAULT_GRADIENT.from,
	            to: gradient?.to || DEFAULT_GRADIENT.to,
	            deg: gradient?.deg || DEFAULT_GRADIENT.deg
	        };
	        return {
	            background: `linear-gradient(${merged.deg}deg, ${themeColor(merged.from, primaryShade)} 0%, ${themeColor(merged.to, primaryShade)} 100%)`,
	            color: theme.colors.white.value,
	            border: 'transparent',
	            hover: null
	        };
	    }
	    if (variant === 'subtle') {
	        return {
	            border: 'transparent',
	            background: 'transparent',
	            color: [
	                color === 'dark' ? themeColor('dark', 0) : themeColor(color, 2),
	                color === 'dark' ? themeColor('dark', 9) : themeColor(color, primaryShade)
	            ],
	            hover: [rgba(themeColor(color, 8), 0.35), rgba(themeColor(color, 0), 1)]
	        };
	    }
	    return {
	        border: 'transparent',
	        background: [themeColor(color, 8), themeColor(color, primaryShade)],
	        color: theme.colors.white.value,
	        hover: themeColor(color, 7)
	    };
	}

	const fns = {
	    cover,
	    size,
	    radius,
	    themeColor,
	    variant,
	    rgba
	};

	/* eslint-disable @typescript-eslint/ban-ts-comment */
	function useSvelteUITheme() {
	    let observer;
	    colorScheme?.subscribe((mode) => {
	        observer = mode;
	    });
	    const DEFAULT_THEME = {
	        // @ts-ignore
	        ...theme,
	        colorNames: colorNameMap,
	        colorScheme: observer,
	        dark: dark?.selector,
	        fn: {
	            cover: fns.cover,
	            themeColor: fns.themeColor,
	            size: fns.size,
	            radius: fns.radius,
	            rgba: fns.rgba,
	            variant: fns.variant
	        }
	    };
	    return DEFAULT_THEME;
	}

	const hasOwn = {}.hasOwnProperty;
	function cx(...args) {
	    const classes = [];
	    for (let i = 0; i < args.length; i++) {
	        const arg = args[i];
	        if (!arg)
	            continue;
	        const argType = typeof arg;
	        if (argType === 'string' || argType === 'number') {
	            classes.push(arg);
	        }
	        else if (Array.isArray(arg)) {
	            if (arg.length) {
	                const inner = { ...arg };
	                if (inner) {
	                    classes.push(inner);
	                }
	            }
	        }
	        else if (argType === 'object') {
	            if (arg.toString === Object.prototype.toString) {
	                for (const key in arg) {
	                    if (hasOwn.call(arg, key) && arg[key]) {
	                        classes.push(key);
	                    }
	                }
	            }
	            else {
	                classes.push(arg.toString());
	            }
	        }
	    }
	    return classes.join(' ');
	}
	function cssFactory() {
	    // This is a factory function to allow for scalability
	    return { cx };
	}

	function fromEntries(entries) {
	    const o = {};
	    Object.keys(entries).forEach((key) => {
	        const [k, v] = entries[key];
	        o[k] = v;
	    });
	    return o;
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */
	const CLASS_KEY = 'svelteui';
	function createRef(refName) {
	    return `__svelteui-ref-${refName || ''}`;
	}
	/**
	 * Sanitizes the provided CSS object, converting certain keywords to
	 * respective CSS selectors, transforms keys into generated CSS classes
	 * and returns the mapping between these generated classes and their initial
	 * keys.
	 *
	 * @param object The CSS object that has not yet been sanitized.
	 * @param theme The current theme object.
	 * @param ref The ref object.
	 * @returns The class map that maps the name of the key in the CSS object
	 * and the generated hash class.
	 */
	function sanitizeCss(object, theme) {
	    // builds this to map the generated class name to the class key
	    // given in the CSS object
	    const refs = [];
	    const classMap = {};
	    const _sanitizeVariants = (obj) => {
	        const variantsObject = obj.variation ?? obj;
	        const variants = Object.keys(variantsObject);
	        for (const variant of variants) {
	            _sanitize(variantsObject[variant]);
	        }
	    };
	    const _sanitize = (obj) => {
	        Object.keys(obj).map((value) => {
	            // transforms certain keywords into the correct CSS selectors
	            if (value === 'variants') {
	                _sanitizeVariants(obj[value]);
	                return;
	            }
	            // saves the reference value so that later it can be added
	            // to reference the CSS selector
	            if (value === 'ref') {
	                refs.push(obj.ref);
	            }
	            if (value === 'darkMode') {
	                obj[`${theme.dark} &`] = obj.darkMode;
	            }
	            // returns the recursive call if the CSS is not an object
	            if (obj[value] === null || typeof obj[value] !== 'object')
	                return;
	            // calls the sanitize method recursively so that it can sanitize
	            // all the style objects
	            _sanitize(obj[value]);
	            // removes the darkMode style since it has been switched
	            // to the correct CSS selector
	            if (value === 'darkMode') {
	                delete obj[value];
	            }
	            else if (value.startsWith('@media')) ;
	            // only adds the correct selectors if it has none
	            else if (!value.startsWith('&') && !value.startsWith(theme.dark)) {
	                const getStyles = css(obj[value]);
	                classMap[value] = getStyles().toString();
	                obj[`& .${getStyles().toString()}`] = obj[value];
	                delete obj[value];
	            }
	        });
	    };
	    _sanitize(object);
	    // deletes the root key since it won't be sanitized here
	    delete object['& .root'];
	    return { classMap, refs: Array.from(new Set(refs)) };
	}
	function createStyles(input) {
	    const getCssObject = typeof input === 'function' ? input : () => input;
	    function useStyles(params = {}, options) {
	        // uses the theme present in the current context or fallbacks to the default theme
	        const theme = useSvelteUIThemeContext()?.theme || useSvelteUITheme();
	        const { cx } = cssFactory();
	        const { override, name } = options || {};
	        const dirtyCssObject = getCssObject(theme, params, createRef);
	        // builds the CSS object that contains transformed values
	        const sanitizedCss = Object.assign({}, dirtyCssObject);
	        const { classMap, refs } = sanitizeCss(sanitizedCss, theme);
	        const root = dirtyCssObject['root'] ?? undefined;
	        const cssObjectClean = root !== undefined ? { ...root, ...sanitizedCss } : dirtyCssObject;
	        const getStyles = css(cssObjectClean);
	        // transforms the keys into strings to be consumed by the classes
	        const classes = fromEntries(Object.keys(dirtyCssObject).map((keys) => {
	            const ref = refs.find((r) => r.includes(keys)) ?? '';
	            const getRefName = ref?.split('-') ?? [];
	            const keyIsRef = ref?.split('-')[getRefName?.length - 1] === keys;
	            const value = keys.toString();
	            let transformedClasses = classMap[value] ?? value;
	            // add the value to the array if the ref provided is valid
	            if (ref && keyIsRef) {
	                transformedClasses = `${transformedClasses} ${ref}`;
	            }
	            // generates the root styles, applying the override styles
	            if (keys === 'root') {
	                transformedClasses = getStyles({ css: override }).toString();
	            }
	            // adds a custom class that can be used to override style
	            let libClass = `${CLASS_KEY}-${keys.toString()}`;
	            if (name) {
	                libClass = `${CLASS_KEY}-${name}-${keys.toString()}`;
	                transformedClasses = `${transformedClasses} ${libClass}`;
	            }
	            return [keys, transformedClasses];
	        }));
	        return {
	            cx,
	            theme,
	            classes,
	            getStyles: css(cssObjectClean)
	        };
	    }
	    return useStyles;
	}

	const SYSTEM_PROPS = {
	    mt: 'marginTop',
	    mb: 'marginBottom',
	    ml: 'marginLeft',
	    mr: 'marginRight',
	    pt: 'paddingTop',
	    pb: 'paddingBottom',
	    pl: 'paddingLeft',
	    pr: 'paddingRight'
	};
	const NEGATIVE_VALUES = ['-xs', '-sm', '-md', '-lg', '-xl'];
	function isValidSizeValue(margin) {
	    return typeof margin === 'string' || typeof margin === 'number';
	}
	function getSizeValue(margin, theme) {
	    if (NEGATIVE_VALUES.includes(margin)) {
	        return theme.fn.size({ size: margin.replace('-', ''), sizes: theme.space }) * -1;
	    }
	    return theme.fn.size({ size: margin, sizes: theme.space });
	}
	function getSystemStyles(systemStyles, theme) {
	    const styles = {};
	    if (isValidSizeValue(systemStyles.p)) {
	        const value = getSizeValue(systemStyles.p, theme);
	        styles.padding = value;
	    }
	    if (isValidSizeValue(systemStyles.m)) {
	        const value = getSizeValue(systemStyles.m, theme);
	        styles.margin = value;
	    }
	    if (isValidSizeValue(systemStyles.py)) {
	        const value = getSizeValue(systemStyles.py, theme);
	        styles.paddingTop = value;
	        styles.paddingBottom = value;
	    }
	    if (isValidSizeValue(systemStyles.px)) {
	        const value = getSizeValue(systemStyles.px, theme);
	        styles.paddingLeft = value;
	        styles.paddingRight = value;
	    }
	    if (isValidSizeValue(systemStyles.my)) {
	        const value = getSizeValue(systemStyles.my, theme);
	        styles.marginTop = value;
	        styles.marginBottom = value;
	    }
	    if (isValidSizeValue(systemStyles.mx)) {
	        const value = getSizeValue(systemStyles.mx, theme);
	        styles.marginLeft = value;
	        styles.marginRight = value;
	    }
	    Object.keys(SYSTEM_PROPS).forEach((property) => {
	        if (isValidSizeValue(systemStyles[property])) {
	            styles[SYSTEM_PROPS[property]] = theme.fn.size({
	                size: getSizeValue(systemStyles[property], theme),
	                sizes: theme.space
	            });
	        }
	    });
	    return styles;
	}

	/* node_modules/@svelteuidev/core/dist/components/Box/Box.svelte generated by Svelte v4.2.12 */

	function create_else_block$1(ctx) {
		let div;
		let div_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[28].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[32], null);

		let div_levels = [
			{
				class: div_class_value = "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
					css: {
						.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
						.../*systemStyles*/ ctx[6]
					}
				}))
			},
			/*$$restProps*/ ctx[12]
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");
				if (default_slot) default_slot.c();
				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				/*div_binding*/ ctx[31](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(/*forwardEvents*/ ctx[9].call(null, div)),
						action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[1]))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 2)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[32],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[32])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[32], dirty, null),
							null
						);
					}
				}

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty[0] & /*className, BoxStyles, getCSSStyles, systemStyles*/ 452 && div_class_value !== (div_class_value = "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
						css: {
							.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
							.../*systemStyles*/ ctx[6]
						}
					})))) && { class: div_class_value },
					dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (default_slot) default_slot.d(detaching);
				/*div_binding*/ ctx[31](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (64:50) 
	function create_if_block_1(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{
				use: [/*forwardEvents*/ ctx[9], [useActions, /*use*/ ctx[1]]]
			},
			{
				class: "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
					css: {
						.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
						.../*systemStyles*/ ctx[6]
					}
				}))
			},
			/*$$restProps*/ ctx[12]
		];

		var switch_value = /*root*/ ctx[3];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			};

			for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
				switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
			}

			if (dirty !== undefined && dirty[0] & /*forwardEvents, use, className, BoxStyles, getCSSStyles, theme, systemStyles, $$restProps*/ 7110) {
				switch_instance_props = assign(switch_instance_props, get_spread_update(switch_instance_spread_levels, [
					dirty[0] & /*forwardEvents, use*/ 514 && {
						use: [/*forwardEvents*/ ctx[9], [useActions, /*use*/ ctx[1]]]
					},
					dirty[0] & /*className, BoxStyles, getCSSStyles, theme, systemStyles*/ 2500 && {
						class: "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
							css: {
								.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
								.../*systemStyles*/ ctx[6]
							}
						}))
					},
					dirty[0] & /*$$restProps*/ 4096 && get_spread_object(/*$$restProps*/ ctx[12])
				]));
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[30](switch_instance);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*root*/ 8 && switch_value !== (switch_value = /*root*/ ctx[3])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[30](switch_instance);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty[0] & /*forwardEvents, use, className, BoxStyles, getCSSStyles, theme, systemStyles, $$restProps*/ 7110)
					? get_spread_update(switch_instance_spread_levels, [
							dirty[0] & /*forwardEvents, use*/ 514 && {
								use: [/*forwardEvents*/ ctx[9], [useActions, /*use*/ ctx[1]]]
							},
							dirty[0] & /*className, BoxStyles, getCSSStyles, theme, systemStyles*/ 2500 && {
								class: "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
									css: {
										.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
										.../*systemStyles*/ ctx[6]
									}
								}))
							},
							dirty[0] & /*$$restProps*/ 4096 && get_spread_object(/*$$restProps*/ ctx[12])
						])
					: {};

					if (dirty[1] & /*$$scope*/ 2) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[30](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	// (52:0) {#if isHTMLElement}
	function create_if_block$3(ctx) {
		let current;
		let svelte_element = /*castRoot*/ ctx[10]() && create_dynamic_element(ctx);

		return {
			c() {
				if (svelte_element) svelte_element.c();
			},
			m(target, anchor) {
				if (svelte_element) svelte_element.m(target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*castRoot*/ ctx[10]()) {
					svelte_element.p(ctx, dirty);
				}
			},
			i(local) {
				if (current) return;
				transition_in(svelte_element, local);
				current = true;
			},
			o(local) {
				transition_out(svelte_element, local);
				current = false;
			},
			d(detaching) {
				if (svelte_element) svelte_element.d(detaching);
			}
		};
	}

	// (65:1) <svelte:component   this={root}   bind:this={element}   use={[forwardEvents, [useActions, use]]}   class="{className} {BoxStyles({ css: { ...getCSSStyles(theme), ...systemStyles } })}"   {...$$restProps}  >
	function create_default_slot$2(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[28].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[32], null);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 2)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[32],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[32])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[32], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	// (54:1) <svelte:element   bind:this={element}   this={castRoot()}   use:forwardEvents   use:useActions={use}   class="{className} {BoxStyles({ css: {...getCSSStyles(theme), ...systemStyles} })}"   {...$$restProps}  >
	function create_dynamic_element(ctx) {
		let svelte_element;
		let svelte_element_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[28].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[32], null);

		let svelte_element_levels = [
			{
				class: svelte_element_class_value = "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
					css: {
						.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
						.../*systemStyles*/ ctx[6]
					}
				}))
			},
			/*$$restProps*/ ctx[12]
		];

		let svelte_element_data = {};

		for (let i = 0; i < svelte_element_levels.length; i += 1) {
			svelte_element_data = assign(svelte_element_data, svelte_element_levels[i]);
		}

		return {
			c() {
				svelte_element = element(/*castRoot*/ ctx[10]());
				if (default_slot) default_slot.c();
				set_dynamic_element_data(/*castRoot*/ ctx[10]())(svelte_element, svelte_element_data);
			},
			m(target, anchor) {
				insert(target, svelte_element, anchor);

				if (default_slot) {
					default_slot.m(svelte_element, null);
				}

				/*svelte_element_binding*/ ctx[29](svelte_element);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(/*forwardEvents*/ ctx[9].call(null, svelte_element)),
						action_destroyer(useActions_action = useActions.call(null, svelte_element, /*use*/ ctx[1]))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 2)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[32],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[32])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[32], dirty, null),
							null
						);
					}
				}

				set_dynamic_element_data(/*castRoot*/ ctx[10]())(svelte_element, svelte_element_data = get_spread_update(svelte_element_levels, [
					(!current || dirty[0] & /*className, BoxStyles, getCSSStyles, systemStyles*/ 452 && svelte_element_class_value !== (svelte_element_class_value = "" + (/*className*/ ctx[2] + " " + /*BoxStyles*/ ctx[7]({
						css: {
							.../*getCSSStyles*/ ctx[8](/*theme*/ ctx[11]),
							.../*systemStyles*/ ctx[6]
						}
					})))) && { class: svelte_element_class_value },
					dirty[0] & /*$$restProps*/ 4096 && /*$$restProps*/ ctx[12]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(svelte_element);
				}

				if (default_slot) default_slot.d(detaching);
				/*svelte_element_binding*/ ctx[29](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$7(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block$3, create_if_block_1, create_else_block$1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*isHTMLElement*/ ctx[4]) return 0;
			if (/*isComponent*/ ctx[5] && typeof /*root*/ ctx[3] !== 'string') return 1;
			return 2;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	function instance$6($$self, $$props, $$invalidate) {
		let getCSSStyles;
		let BoxStyles;
		let systemStyles;

		const omit_props_names = [
			"use","element","class","css","root","m","my","mx","mt","mb","ml","mr","p","py","px","pt","pb","pl","pr"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		let { use = [], element = undefined, class: className = '', css: css$1 = {}, root = undefined, m = undefined, my = undefined, mx = undefined, mt = undefined, mb = undefined, ml = undefined, mr = undefined, p = undefined, py = undefined, px = undefined, pt = undefined, pb = undefined, pl = undefined, pr = undefined } = $$props;

		/** An action that forwards inner dom node events from parent component */
		const forwardEvents = createEventForwarder(get_current_component());

		/** workaround for root type errors, this should be replaced by a better type system */
		const castRoot = () => root;

		const theme = useSvelteUIThemeContext()?.theme || useSvelteUITheme();
		let isHTMLElement;
		let isComponent;

		function svelte_element_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(0, element);
			});
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(0, element);
			});
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(0, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(12, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('element' in $$new_props) $$invalidate(0, element = $$new_props.element);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('css' in $$new_props) $$invalidate(13, css$1 = $$new_props.css);
			if ('root' in $$new_props) $$invalidate(3, root = $$new_props.root);
			if ('m' in $$new_props) $$invalidate(14, m = $$new_props.m);
			if ('my' in $$new_props) $$invalidate(15, my = $$new_props.my);
			if ('mx' in $$new_props) $$invalidate(16, mx = $$new_props.mx);
			if ('mt' in $$new_props) $$invalidate(17, mt = $$new_props.mt);
			if ('mb' in $$new_props) $$invalidate(18, mb = $$new_props.mb);
			if ('ml' in $$new_props) $$invalidate(19, ml = $$new_props.ml);
			if ('mr' in $$new_props) $$invalidate(20, mr = $$new_props.mr);
			if ('p' in $$new_props) $$invalidate(21, p = $$new_props.p);
			if ('py' in $$new_props) $$invalidate(22, py = $$new_props.py);
			if ('px' in $$new_props) $$invalidate(23, px = $$new_props.px);
			if ('pt' in $$new_props) $$invalidate(24, pt = $$new_props.pt);
			if ('pb' in $$new_props) $$invalidate(25, pb = $$new_props.pb);
			if ('pl' in $$new_props) $$invalidate(26, pl = $$new_props.pl);
			if ('pr' in $$new_props) $$invalidate(27, pr = $$new_props.pr);
			if ('$$scope' in $$new_props) $$invalidate(32, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*css*/ 8192) {
				$$invalidate(8, getCSSStyles = typeof css$1 === 'function' ? css$1 : () => css$1);
			}

			if ($$self.$$.dirty[0] & /*root*/ 8) {
				{
					$$invalidate(4, isHTMLElement = root && typeof root === 'string');
					$$invalidate(5, isComponent = root && typeof root === 'function');
				}
			}

			if ($$self.$$.dirty[0] & /*m, my, mx, mt, mb, ml, mr, p, py, px, pt, pb, pl, pr*/ 268419072) {
				$$invalidate(6, systemStyles = getSystemStyles(
					{
						m,
						my,
						mx,
						mt,
						mb,
						ml,
						mr,
						p,
						py,
						px,
						pt,
						pb,
						pl,
						pr
					},
					theme
				));
			}
		};

		$$invalidate(7, BoxStyles = css({}));

		return [
			element,
			use,
			className,
			root,
			isHTMLElement,
			isComponent,
			systemStyles,
			BoxStyles,
			getCSSStyles,
			forwardEvents,
			castRoot,
			theme,
			$$restProps,
			css$1,
			m,
			my,
			mx,
			mt,
			mb,
			ml,
			mr,
			p,
			py,
			px,
			pt,
			pb,
			pl,
			pr,
			slots,
			svelte_element_binding,
			switch_instance_binding,
			div_binding,
			$$scope
		];
	}

	class Box extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance$6,
				create_fragment$7,
				safe_not_equal,
				{
					use: 1,
					element: 0,
					class: 2,
					css: 13,
					root: 3,
					m: 14,
					my: 15,
					mx: 16,
					mt: 17,
					mb: 18,
					ml: 19,
					mr: 20,
					p: 21,
					py: 22,
					px: 23,
					pt: 24,
					pb: 25,
					pl: 26,
					pr: 27
				},
				null,
				[-1, -1]
			);
		}
	}

	var useStyles$1 = createStyles((theme) => ({
	    root: {
	        [`${theme.dark} &`]: {
	            color: theme.colors['dark50']?.value
	        },
	        focusRing: 'auto',
	        cursor: 'pointer',
	        border: 0,
	        padding: 0,
	        appearance: 'none',
	        fontFamily: theme.fonts.standard.value ?? 'sans-serif',
	        fontSize: theme.fontSizes.md.value,
	        backgroundColor: 'transparent',
	        textAlign: 'left',
	        color: 'black',
	        textDecoration: 'none'
	    }
	}));

	/* node_modules/@svelteuidev/core/dist/components/Button/UnstyledButton/UnstyledButton.svelte generated by Svelte v4.2.12 */

	function create_default_slot$1(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[10].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 4096)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[12],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[12])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function create_fragment$6(ctx) {
		let box;
		let updating_element;
		let current;

		const box_spread_levels = [
			{
				use: [/*forwardEvents*/ ctx[8], [useActions, /*use*/ ctx[1]]]
			},
			{
				class: /*cx*/ ctx[7](/*className*/ ctx[2], /*classes*/ ctx[6].root, /*getStyles*/ ctx[5]({ css: /*override*/ ctx[3] }))
			},
			{ root: /*root*/ ctx[4] },
			/*$$restProps*/ ctx[9]
		];

		function box_element_binding(value) {
			/*box_element_binding*/ ctx[11](value);
		}

		let box_props = {
			$$slots: { default: [create_default_slot$1] },
			$$scope: { ctx }
		};

		for (let i = 0; i < box_spread_levels.length; i += 1) {
			box_props = assign(box_props, box_spread_levels[i]);
		}

		if (/*element*/ ctx[0] !== void 0) {
			box_props.element = /*element*/ ctx[0];
		}

		box = new Box({ props: box_props });
		binding_callbacks.push(() => bind(box, 'element', box_element_binding));

		return {
			c() {
				create_component(box.$$.fragment);
			},
			m(target, anchor) {
				mount_component(box, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const box_changes = (dirty & /*forwardEvents, use, cx, className, classes, getStyles, override, root, $$restProps*/ 1022)
				? get_spread_update(box_spread_levels, [
						dirty & /*forwardEvents, use*/ 258 && {
							use: [/*forwardEvents*/ ctx[8], [useActions, /*use*/ ctx[1]]]
						},
						dirty & /*cx, className, classes, getStyles, override*/ 236 && {
							class: /*cx*/ ctx[7](/*className*/ ctx[2], /*classes*/ ctx[6].root, /*getStyles*/ ctx[5]({ css: /*override*/ ctx[3] }))
						},
						dirty & /*root*/ 16 && { root: /*root*/ ctx[4] },
						dirty & /*$$restProps*/ 512 && get_spread_object(/*$$restProps*/ ctx[9])
					])
				: {};

				if (dirty & /*$$scope*/ 4096) {
					box_changes.$$scope = { dirty, ctx };
				}

				if (!updating_element && dirty & /*element*/ 1) {
					updating_element = true;
					box_changes.element = /*element*/ ctx[0];
					add_flush_callback(() => updating_element = false);
				}

				box.$set(box_changes);
			},
			i(local) {
				if (current) return;
				transition_in(box.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(box.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(box, detaching);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let cx;
		let classes;
		let getStyles;
		const omit_props_names = ["use","element","class","override","root"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		let { use = [], element = undefined, class: className = '', override = {}, root = 'button' } = $$props;

		/** An action that forwards inner dom node events from parent component */
		const forwardEvents = createEventForwarder(get_current_component());

		function box_element_binding(value) {
			element = value;
			$$invalidate(0, element);
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(9, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('element' in $$new_props) $$invalidate(0, element = $$new_props.element);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('override' in $$new_props) $$invalidate(3, override = $$new_props.override);
			if ('root' in $$new_props) $$invalidate(4, root = $$new_props.root);
			if ('$$scope' in $$new_props) $$invalidate(12, $$scope = $$new_props.$$scope);
		};

		$$invalidate(7, { cx, classes, getStyles } = useStyles$1(null, { name: 'UnstyledButton' }), cx, $$invalidate(6, classes), $$invalidate(5, getStyles));

		return [
			element,
			use,
			className,
			override,
			root,
			getStyles,
			classes,
			cx,
			forwardEvents,
			$$restProps,
			slots,
			box_element_binding,
			$$scope
		];
	}

	class UnstyledButton extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$5, create_fragment$6, safe_not_equal, {
				use: 1,
				element: 0,
				class: 2,
				override: 3,
				root: 4
			});
		}
	}

	const sizes = {
	    xs: 12,
	    sm: 18,
	    md: 24,
	    lg: 34,
	    xl: 42
	};
	var useStyles = createStyles((theme, { color, size, opened }) => {
	    const sizeValue = theme.fn.size({ size, sizes });
	    return {
	        root: {
	            borderRadius: theme.radii.sm.value,
	            width: sizeValue + 10,
	            height: sizeValue + 10,
	            padding: +theme.space.xs.value / 2,
	            cursor: 'pointer'
	        },
	        burger: {
	            position: 'relative',
	            userSelect: 'none',
	            boxSizing: 'border-box',
	            '&, &:before, &:after': {
	                [`${theme.dark} &`]: {
	                    backgroundColor: theme.fn.themeColor(color, 8)
	                },
	                display: 'block',
	                width: sizeValue,
	                height: Math.ceil(sizeValue / 12),
	                backgroundColor: theme.fn.themeColor(color, 6),
	                outline: '1px solid transparent',
	                transitionProperty: 'background-color, transform',
	                transitionDuration: '300ms',
	                '@media (prefers-reduced-motion)': {
	                    transitionDuration: '0ms'
	                }
	            },
	            '&:before, &:after': {
	                position: 'absolute',
	                content: '""',
	                left: 0
	            },
	            '&:before': {
	                top: (sizeValue / 3) * -1
	            },
	            '&:after': {
	                top: sizeValue / 3
	            },
	            '&.opened': opened
	                ? {
	                    backgroundColor: 'transparent',
	                    '&:before': {
	                        transform: `translateY(${sizeValue / 3}px) rotate(45deg)`
	                    },
	                    '&:after': {
	                        transform: `translateY(-${sizeValue / 3}px) rotate(-45deg)`
	                    }
	                }
	                : {}
	        }
	    };
	});

	/* node_modules/@svelteuidev/core/dist/components/Burger/Burger.svelte generated by Svelte v4.2.12 */

	function create_default_slot(ctx) {
		let span;
		let span_class_value;

		return {
			c() {
				span = element("span");
				attr(span, "class", span_class_value = /*cx*/ ctx[5](/*classes*/ ctx[7].burger, { opened: /*opened*/ ctx[4] }));
			},
			m(target, anchor) {
				insert(target, span, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*cx, classes, opened*/ 176 && span_class_value !== (span_class_value = /*cx*/ ctx[5](/*classes*/ ctx[7].burger, { opened: /*opened*/ ctx[4] }))) {
					attr(span, "class", span_class_value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	function create_fragment$5(ctx) {
		let unstyledbutton;
		let updating_element;
		let current;

		const unstyledbutton_spread_levels = [
			{
				use: [/*forwardEvents*/ ctx[8], [useActions, /*use*/ ctx[1]]]
			},
			{ override: { padding: 5 } },
			{
				class: /*cx*/ ctx[5](/*className*/ ctx[2], /*classes*/ ctx[7].root, /*getStyles*/ ctx[6]({ css: /*override*/ ctx[3] }))
			},
			/*$$restProps*/ ctx[9]
		];

		function unstyledbutton_element_binding(value) {
			/*unstyledbutton_element_binding*/ ctx[14](value);
		}

		let unstyledbutton_props = {
			$$slots: { default: [create_default_slot] },
			$$scope: { ctx }
		};

		for (let i = 0; i < unstyledbutton_spread_levels.length; i += 1) {
			unstyledbutton_props = assign(unstyledbutton_props, unstyledbutton_spread_levels[i]);
		}

		if (/*element*/ ctx[0] !== void 0) {
			unstyledbutton_props.element = /*element*/ ctx[0];
		}

		unstyledbutton = new UnstyledButton({ props: unstyledbutton_props });
		binding_callbacks.push(() => bind(unstyledbutton, 'element', unstyledbutton_element_binding));

		return {
			c() {
				create_component(unstyledbutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(unstyledbutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const unstyledbutton_changes = (dirty & /*forwardEvents, use, cx, className, classes, getStyles, override, $$restProps*/ 1006)
				? get_spread_update(unstyledbutton_spread_levels, [
						dirty & /*forwardEvents, use*/ 258 && {
							use: [/*forwardEvents*/ ctx[8], [useActions, /*use*/ ctx[1]]]
						},
						unstyledbutton_spread_levels[1],
						dirty & /*cx, className, classes, getStyles, override*/ 236 && {
							class: /*cx*/ ctx[5](/*className*/ ctx[2], /*classes*/ ctx[7].root, /*getStyles*/ ctx[6]({ css: /*override*/ ctx[3] }))
						},
						dirty & /*$$restProps*/ 512 && get_spread_object(/*$$restProps*/ ctx[9])
					])
				: {};

				if (dirty & /*$$scope, cx, classes, opened*/ 32944) {
					unstyledbutton_changes.$$scope = { dirty, ctx };
				}

				if (!updating_element && dirty & /*element*/ 1) {
					updating_element = true;
					unstyledbutton_changes.element = /*element*/ ctx[0];
					add_flush_callback(() => updating_element = false);
				}

				unstyledbutton.$set(unstyledbutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(unstyledbutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(unstyledbutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(unstyledbutton, detaching);
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		let _color;
		let classes;
		let getStyles;
		let cx;
		const omit_props_names = ["use","element","class","override","opened","color","size"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let $colorScheme;
		component_subscribe($$self, colorScheme, $$value => $$invalidate(13, $colorScheme = $$value));
		let { use = [], element = undefined, class: className = '', override = {}, opened = true, color = undefined, size = 'md' } = $$props;

		/** An action that forwards inner dom node events from parent component */
		const forwardEvents = createEventForwarder(get_current_component());

		function unstyledbutton_element_binding(value) {
			element = value;
			$$invalidate(0, element);
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(9, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('element' in $$new_props) $$invalidate(0, element = $$new_props.element);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('override' in $$new_props) $$invalidate(3, override = $$new_props.override);
			if ('opened' in $$new_props) $$invalidate(4, opened = $$new_props.opened);
			if ('color' in $$new_props) $$invalidate(10, color = $$new_props.color);
			if ('size' in $$new_props) $$invalidate(11, size = $$new_props.size);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*color, $colorScheme*/ 9216) {
				$$invalidate(12, _color = color
				? color
				: $colorScheme === 'dark' ? 'white' : 'black');
			}

			if ($$self.$$.dirty & /*_color, size, opened*/ 6160) {
				$$invalidate(7, { classes, getStyles, cx } = useStyles({ color: _color, size, opened }, { name: 'Burger' }), classes, ((((($$invalidate(6, getStyles), $$invalidate(12, _color)), $$invalidate(11, size)), $$invalidate(4, opened)), $$invalidate(10, color)), $$invalidate(13, $colorScheme)), ((((($$invalidate(5, cx), $$invalidate(12, _color)), $$invalidate(11, size)), $$invalidate(4, opened)), $$invalidate(10, color)), $$invalidate(13, $colorScheme)));
			}
		};

		return [
			element,
			use,
			className,
			override,
			opened,
			cx,
			getStyles,
			classes,
			forwardEvents,
			$$restProps,
			color,
			size,
			_color,
			$colorScheme,
			unstyledbutton_element_binding
		];
	}

	class Burger extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$4, create_fragment$5, safe_not_equal, {
				use: 1,
				element: 0,
				class: 2,
				override: 3,
				opened: 4,
				color: 10,
				size: 11
			});
		}
	}

	var Burger$1 = Burger;

	/* src/components/Modal.svelte generated by Svelte v4.2.12 */

	function create_if_block$2(ctx) {
		let div2;
		let div1;
		let button;
		let t1;
		let div0;
		let p;
		let a0;
		let t2;
		let t3;
		let a1;
		let t4;
		let t5;
		let a2;
		let t6;
		let mounted;
		let dispose;

		return {
			c() {
				div2 = element("div");
				div1 = element("div");
				button = element("button");
				button.textContent = "×";
				t1 = space();
				div0 = element("div");
				p = element("p");
				a0 = element("a");
				t2 = text("EMAIL   |");
				t3 = space();
				a1 = element("a");
				t4 = text(phoneNumber);
				t5 = space();
				a2 = element("a");
				t6 = text("|   FACEBOOK");
				attr(button, "class", "close-button-modal");
				attr(button, "tabindex", "0");
				attr(button, "aria-label", "Fermer la fenêtre modale");
				attr(a0, "class", "contact-link");
				attr(a0, "href", emailLink);
				attr(a0, "target", "_blank");
				attr(a0, "aria-label", "Envoyer un email à Parenthèse Océane");
				attr(a1, "class", "contact-link");
				attr(a1, "href", "tel:" + phoneNumber);
				attr(a1, "aria-label", "Appeler Parenthèse Océane");
				attr(a2, "class", "contact-link");
				attr(a2, "href", facebookLink);
				attr(a2, "target", "_blank");
				attr(a2, "aria-label", "Visiter la page Facebook de Parenthèse Océane");
				attr(div0, "class", "modal-content");
				attr(div1, "class", "modal");
				attr(div2, "class", "modal-overlay");
			},
			m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div1);
				append(div1, button);
				append(div1, t1);
				append(div1, div0);
				append(div0, p);
				append(p, a0);
				append(a0, t2);
				append(p, t3);
				append(p, a1);
				append(a1, t4);
				append(p, t5);
				append(p, a2);
				append(a2, t6);

				if (!mounted) {
					dispose = [
						listen(button, "click", /*closeModal*/ ctx[1]),
						listen(button, "keydown", /*handleKeyDown*/ ctx[2])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(div2);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$4(ctx) {
		let section;
		let if_block = /*showModal*/ ctx[0] && create_if_block$2(ctx);

		return {
			c() {
				section = element("section");
				if (if_block) if_block.c();
			},
			m(target, anchor) {
				insert(target, section, anchor);
				if (if_block) if_block.m(section, null);
			},
			p(ctx, [dirty]) {
				if (/*showModal*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$2(ctx);
						if_block.c();
						if_block.m(section, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				if (if_block) if_block.d();
			}
		};
	}

	let emailLink = "parentheseoceane@orange.fr";
	let phoneNumber = "+33 06 37 66 38 66";
	let facebookLink = "https://www.facebook.com/profile.php?id=100077286376919";

	function instance$3($$self, $$props, $$invalidate) {
		let showModal = true;

		function closeModal() {
			$$invalidate(0, showModal = false);
		}

		function handleKeyDown(event) {
			if (event.key === 'Enter') {
				closeModal();
			}
		}

		return [showModal, closeModal, handleKeyDown];
	}

	class Modal extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$3, create_fragment$4, safe_not_equal, {});
		}
	}

	/* src/components/Button.svelte generated by Svelte v4.2.12 */

	function create_else_block(ctx) {
		let img;
		let img_src_value;

		return {
			c() {
				img = element("img");
				attr(img, "class", "moodDarkMod");
				if (!src_url_equal(img.src, img_src_value = "src/assets/moodDarkMode.svg")) attr(img, "src", img_src_value);
				attr(img, "alt", "soleil");
			},
			m(target, anchor) {
				insert(target, img, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(img);
				}
			}
		};
	}

	// (44:4) {#if darkMode}
	function create_if_block$1(ctx) {
		let img;
		let img_src_value;

		return {
			c() {
				img = element("img");
				attr(img, "class", "sunDarkMod");
				if (!src_url_equal(img.src, img_src_value = "src/assets/sunDarkMode.svg")) attr(img, "src", img_src_value);
				attr(img, "alt", "lune");
			},
			m(target, anchor) {
				insert(target, img, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(img);
				}
			}
		};
	}

	function create_fragment$3(ctx) {
		let button;
		let mounted;
		let dispose;

		function select_block_type(ctx, dirty) {
			if (/*darkMode*/ ctx[0]) return create_if_block$1;
			return create_else_block;
		}

		let current_block_type = select_block_type(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				button = element("button");
				if_block.c();
				attr(button, "class", "buttonDarkMode");
				attr(button, "tabindex", "0");
			},
			m(target, anchor) {
				insert(target, button, anchor);
				if_block.m(button, null);

				if (!mounted) {
					dispose = listen(button, "click", /*toggleDarkMode*/ ctx[1]);
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (current_block_type !== (current_block_type = select_block_type(ctx))) {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(button, null);
					}
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				if_block.d();
				mounted = false;
				dispose();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let darkMode = false;

		// Fonction pour activer le mode nuit
		function activerDarkMode() {
			$$invalidate(0, darkMode = true);
			document.body.classList.add('darkMode'); // Ajouter la classe pour le mode nuit au body
			localStorage.setItem('darkMode', 'true'); // Stocker l'état dans localStorage
		}

		// Fonction pour désactiver le mode nuit
		function desactiverDarkMode() {
			$$invalidate(0, darkMode = false);
			document.body.classList.remove('darkMode'); // Supprimer la classe pour le mode nuit du body
			localStorage.setItem('darkMode', 'false'); // Stocker l'état dans localStorage
		}

		// Fonction pour basculer entre les modes
		function toggleDarkMode() {
			if (darkMode) {
				desactiverDarkMode();
			} else {
				activerDarkMode();
			}
		}

		// Vérification de l'état du mode nuit au chargement de la page
		onMount(() => {
			const darkModeValue = localStorage.getItem('darkMode');

			if (darkModeValue === 'true') {
				activerDarkMode();
			} else {
				desactiverDarkMode();
			}
		});

		return [darkMode, toggleDarkMode];
	}

	class Button extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
		}
	}

	/* src/components/Header.svelte generated by Svelte v4.2.12 */

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[7] = list[i].label;
		child_ctx[8] = list[i].path;
		return child_ctx;
	}

	// (92:4) {#if opened}
	function create_if_block(ctx) {
		let ul;
		let each_value = ensure_array_like(/*navLinks*/ ctx[1]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		return {
			c() {
				ul = element("ul");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}
			},
			m(target, anchor) {
				insert(target, ul, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(ul, null);
					}
				}
			},
			p(ctx, dirty) {
				if (dirty & /*navLinks, opened, handleNavLinkClick*/ 11) {
					each_value = ensure_array_like(/*navLinks*/ ctx[1]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(ul, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(ul);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (94:8) {#each navLinks as { label, path }}
	function create_each_block(ctx) {
		let li;
		let a;
		let t0_value = /*label*/ ctx[7] + "";
		let t0;
		let a_tabindex_value;
		let t1;
		let mounted;
		let dispose;

		return {
			c() {
				li = element("li");
				a = element("a");
				t0 = text(t0_value);
				t1 = space();
				attr(a, "href", /*path*/ ctx[8]);
				attr(a, "tabindex", a_tabindex_value = /*opened*/ ctx[0] ? 0 : -1);
				attr(li, "class", "menulink");
			},
			m(target, anchor) {
				insert(target, li, anchor);
				append(li, a);
				append(a, t0);
				append(li, t1);

				if (!mounted) {
					dispose = [
						listen(a, "click", /*handleNavLinkClick*/ ctx[3]),
						action_destroyer(link.call(null, a))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*opened*/ 1 && a_tabindex_value !== (a_tabindex_value = /*opened*/ ctx[0] ? 0 : -1)) {
					attr(a, "tabindex", a_tabindex_value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(li);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$2(ctx) {
		let modal;
		let t0;
		let section;
		let div1;
		let div0;
		let burger;
		let t1;
		let t2;
		let a;
		let img;
		let img_class_value;
		let img_src_value;
		let a_tabindex_value;
		let t3;
		let button;
		let current;
		let mounted;
		let dispose;
		modal = new Modal({});

		burger = new Burger$1({
				props: {
					class: "burgerMenu",
					style: "background-color:$primary-light;",
					opened: /*opened*/ ctx[0]
				}
			});

		let if_block = /*opened*/ ctx[0] && create_if_block(ctx);
		button = new Button({});

		return {
			c() {
				create_component(modal.$$.fragment);
				t0 = space();
				section = element("section");
				div1 = element("div");
				div0 = element("div");
				create_component(burger.$$.fragment);
				t1 = space();
				if (if_block) if_block.c();
				t2 = space();
				a = element("a");
				img = element("img");
				t3 = space();
				create_component(button.$$.fragment);
				attr(div0, "class", "menu-toggle");
				attr(div0, "tabindex", "0");
				attr(div0, "aria-label", "Toggle navigation");
				attr(div0, "role", "button");
				attr(img, "class", img_class_value = `logoHome ${/*opened*/ ctx[0] ? "hide-logo" : ""}`);
				if (!src_url_equal(img.src, img_src_value = "src/assets/logo.png")) attr(img, "src", img_src_value);
				attr(img, "alt", "Logo de l'association StVincent");
				attr(a, "href", "/");
				attr(a, "tabindex", a_tabindex_value = /*opened*/ ctx[0] ? -1 : 0);
				attr(div1, "class", "menuHeader");
				attr(section, "class", "menuWrapper");
				attr(section, "role", "navigation");
				attr(section, "aria-label", "Main navigation");
			},
			m(target, anchor) {
				mount_component(modal, target, anchor);
				insert(target, t0, anchor);
				insert(target, section, anchor);
				append(section, div1);
				append(div1, div0);
				mount_component(burger, div0, null);
				append(div1, t1);
				if (if_block) if_block.m(div1, null);
				append(div1, t2);
				append(div1, a);
				append(a, img);
				append(div1, t3);
				mount_component(button, div1, null);
				current = true;

				if (!mounted) {
					dispose = [
						listen(div0, "click", /*handleMenuClick*/ ctx[2]),
						listen(div0, "keydown", /*handleKeyDown*/ ctx[4])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				const burger_changes = {};
				if (dirty & /*opened*/ 1) burger_changes.opened = /*opened*/ ctx[0];
				burger.$set(burger_changes);

				if (/*opened*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.m(div1, t2);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (!current || dirty & /*opened*/ 1 && img_class_value !== (img_class_value = `logoHome ${/*opened*/ ctx[0] ? "hide-logo" : ""}`)) {
					attr(img, "class", img_class_value);
				}

				if (!current || dirty & /*opened*/ 1 && a_tabindex_value !== (a_tabindex_value = /*opened*/ ctx[0] ? -1 : 0)) {
					attr(a, "tabindex", a_tabindex_value);
				}
			},
			i(local) {
				if (current) return;
				transition_in(modal.$$.fragment, local);
				transition_in(burger.$$.fragment, local);
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(modal.$$.fragment, local);
				transition_out(burger.$$.fragment, local);
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(section);
				}

				destroy_component(modal, detaching);
				destroy_component(burger);
				if (if_block) if_block.d();
				destroy_component(button);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let opened = false;

		let navLinks = [
			{ label: "ACCUEIL", path: "/" },
			{ label: "MARÉE HAUTE", path: "/haute" },
			{ label: "ÉTALE", path: "/etale" },
			{ label: "MARÉE BASSE", path: "/basse" },
			{
				label: "CONTACTEZ-NOUS",
				path: "/contact"
			},
			{ label: "INFO", path: "/info" },
			{
				label: "StVincentsurJard",
				path: "/StVincentsurJard"
			}
		];

		onMount(async () => {
			// Attendre que le composant Burger soit monté
			await tick();

			checkScreenWidth();
			window.addEventListener("resize", checkScreenWidth);
			document.addEventListener("click", handleDocumentClick);
			const burgerElement = document.querySelector(".burgerMenu");

			if (burgerElement) {
				burgerElement.setAttribute("tabindex", "0");
			}

			// Définition de la fonction handleEvent ici
			function handleEvent() {
				return () => {
					window.removeEventListener("resize", checkScreenWidth);
					document.removeEventListener("click", handleDocumentClick);
				};
			}

			const cleanup = handleEvent();
			return cleanup;
		});

		function checkScreenWidth() {
			$$invalidate(0, opened = window.innerWidth >= 1025);
		}

		function handleDocumentClick(event) {
			const isDesktop = window.innerWidth >= 1025;

			if (!isDesktop && !event.target.closest(".menuHeader")) {
				$$invalidate(0, opened = false);
			}
		}

		function handleMenuClick() {
			$$invalidate(0, opened = !opened);
		}

		function handleNavLinkClick() {
			const isDesktop = window.innerWidth >= 1025;

			if (!isDesktop) {
				$$invalidate(0, opened = false);
			}
		}

		let handleKeyDown = event => {
			if (event.key === "Enter" || event.key === " ") {
				handleMenuClick();
			}
		};

		return [opened, navLinks, handleMenuClick, handleNavLinkClick, handleKeyDown];
	}

	class Header extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$1, create_fragment$2, safe_not_equal, {});
		}
	}

	/* src/components/Footer.svelte generated by Svelte v4.2.12 */

	function create_fragment$1(ctx) {
		let section;
		let div7;
		let div5;
		let div1;
		let h30;
		let t1;
		let div0;
		let a0;
		let t3;
		let a1;
		let t5;
		let a2;
		let t7;
		let a3;
		let t9;
		let a4;
		let t11;
		let a5;
		let t13;
		let a6;
		let t15;
		let a7;
		let t17;
		let a8;
		let t19;
		let div3;
		let t22;
		let div4;
		let t34;
		let div6;
		let mounted;
		let dispose;

		return {
			c() {
				section = element("section");
				div7 = element("div");
				div5 = element("div");
				div1 = element("div");
				h30 = element("h3");
				h30.textContent = "Plan du site";
				t1 = space();
				div0 = element("div");
				a0 = element("a");
				a0.textContent = "Accueil";
				t3 = space();
				a1 = element("a");
				a1.textContent = "Étale";
				t5 = space();
				a2 = element("a");
				a2.textContent = "Haute";
				t7 = space();
				a3 = element("a");
				a3.textContent = "Basse";
				t9 = space();
				a4 = element("a");
				a4.textContent = "Contact";
				t11 = space();
				a5 = element("a");
				a5.textContent = "Info";
				t13 = space();
				a6 = element("a");
				a6.textContent = "StVincentsurJard";
				t15 = space();
				a7 = element("a");
				a7.textContent = "Charte de Confidentialité";
				t17 = space();
				a8 = element("a");
				a8.textContent = "Conditions Générales de Vente";
				t19 = space();
				div3 = element("div");
				div3.innerHTML = `<h3 class="footer-title">Suivez-nous</h3> <div class="footer-social"><a href="https://www.facebook.com/profile.php?id=100077286376919" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><img class="logo-meta" src="src/assets/logo-meta.svg" alt="logo-meta" aria-hidden="true"/></a></div>`;
				t22 = space();
				div4 = element("div");
				div4.innerHTML = `<h2 class="footer-title">À propos</h2> <address><p>Parenthèse Océane</p> <p>32 Rte de Saint-Hilaire, <br/>85520 Saint-Vincent-sur-Jard</p></address> <p>Téléphone : <a href="tel:+33123456789" aria-label="Numéro de téléphone">+33 1 23 45 67 89</a></p> <a class="footer-mail" href="mailto:parentheseoceane@orange.fr" aria-label="Adresse e-mail">parentheseoceane@orange.fr</a>`;
				t34 = space();
				div6 = element("div");
				div6.innerHTML = `<p>© 2024 Parenthèse Océane. Tous droits réservés.</p>`;
				attr(h30, "class", "footer-title");
				attr(a0, "href", "/");
				attr(a0, "aria-label", "Accueil");
				attr(a0, "tabindex", "0");
				attr(a1, "href", "/etale");
				attr(a1, "aria-label", "Étale");
				attr(a1, "tabindex", "0");
				attr(a2, "href", "/haute");
				attr(a2, "aria-label", "Haute");
				attr(a2, "tabindex", "0");
				attr(a3, "href", "/basse");
				attr(a3, "aria-label", "Basse");
				attr(a3, "tabindex", "0");
				attr(a4, "href", "/contact");
				attr(a4, "aria-label", "Contact");
				attr(a4, "tabindex", "0");
				attr(a5, "href", "/info");
				attr(a5, "aria-label", "Info");
				attr(a5, "tabindex", "0");
				attr(a6, "href", "/infStVincentsurJardo");
				attr(a6, "aria-label", "StVincentsurJard");
				attr(a6, "tabindex", "0");
				attr(a7, "href", "/privacyPolicy");
				attr(a7, "aria-label", "Charte de Confidentialité");
				attr(a7, "tabindex", "0");
				attr(a8, "href", "/Agreement");
				attr(a8, "aria-label", "Conditions Générales de Vente");
				attr(a8, "tabindex", "0");
				attr(div0, "class", "footer-links");
				attr(div1, "class", "footer-section site-links");
				attr(div3, "class", "footer-section follow-us");
				attr(div4, "class", "footer-section about");
				attr(div5, "class", "footer-content");
				attr(div6, "class", "footer-bottom");
				attr(div7, "class", "footer");
				attr(div7, "role", "contentinfo");
				attr(section, "class", "footer-section");
				attr(section, "aria-label", "Footer");
			},
			m(target, anchor) {
				insert(target, section, anchor);
				append(section, div7);
				append(div7, div5);
				append(div5, div1);
				append(div1, h30);
				append(div1, t1);
				append(div1, div0);
				append(div0, a0);
				append(div0, t3);
				append(div0, a1);
				append(div0, t5);
				append(div0, a2);
				append(div0, t7);
				append(div0, a3);
				append(div0, t9);
				append(div0, a4);
				append(div0, t11);
				append(div0, a5);
				append(div0, t13);
				append(div0, a6);
				append(div0, t15);
				append(div0, a7);
				append(div0, t17);
				append(div0, a8);
				append(div5, t19);
				append(div5, div3);
				append(div5, t22);
				append(div5, div4);
				append(div7, t34);
				append(div7, div6);

				if (!mounted) {
					dispose = [
						action_destroyer(link.call(null, a0)),
						action_destroyer(link.call(null, a1)),
						action_destroyer(link.call(null, a2)),
						action_destroyer(link.call(null, a3)),
						action_destroyer(link.call(null, a4)),
						action_destroyer(link.call(null, a5)),
						action_destroyer(link.call(null, a6)),
						action_destroyer(link.call(null, a7)),
						action_destroyer(link.call(null, a8))
					];

					mounted = true;
				}
			},
			p: noop,
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	class Footer extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$1, safe_not_equal, {});
		}
	}

	/* src/App.svelte generated by Svelte v4.2.12 */

	function create_fragment(ctx) {
		let header;
		let t0;
		let router;
		let t1;
		let footer;
		let current;
		header = new Header({});
		router = new Router({ props: { routes } });
		footer = new Footer({});

		return {
			c() {
				create_component(header.$$.fragment);
				t0 = space();
				create_component(router.$$.fragment);
				t1 = space();
				create_component(footer.$$.fragment);
			},
			m(target, anchor) {
				mount_component(header, target, anchor);
				insert(target, t0, anchor);
				mount_component(router, target, anchor);
				insert(target, t1, anchor);
				mount_component(footer, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(header.$$.fragment, local);
				transition_in(router.$$.fragment, local);
				transition_in(footer.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(header.$$.fragment, local);
				transition_out(router.$$.fragment, local);
				transition_out(footer.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}

				destroy_component(header, detaching);
				destroy_component(router, detaching);
				destroy_component(footer, detaching);
			}
		};
	}

	function scrollToTop() {
		window.scrollTo({
			top: 0, //Navigation vers le haut jusqu'à une position de 0 pixels 
			behavior: 'smooth', // Option pour un défilement fluide
			
		});
	}

	function instance($$self, $$props, $$invalidate) {
		let $location;
		component_subscribe($$self, location$1, $$value => $$invalidate(0, $location = $$value));

		beforeUpdate(() => {
			$location === "/"
			? document.body.classList.add("homepage")
			: document.body.classList.remove("homepage");
		});

		// Appeler la fonction scrollToTop lorsque la route change
		location$1.subscribe(() => {
			scrollToTop();
		});

		return [];
	}

	class App extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {});
		}
	}

	const app = new App({
	  target: document.getElementById("app"),
	});

	return app;

})();
//# sourceMappingURL=bundle.js.map
