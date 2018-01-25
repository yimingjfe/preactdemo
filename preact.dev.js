(function () {
	

	/** Virtual DOM Node */
	function VNode() {}

	/** Global options
	 *	@public
	 *	@namespace options {Object}
	 */
	let options = {

		/** If `true`, `prop` changes trigger synchronous component updates.
		*	@name syncComponentUpdates
		*	@type Boolean
		*	@default true
		*/
		//syncComponentUpdates: true,

		/** Processes all created VNodes.
		*	@param {VNode} vnode	A newly-created VNode to normalize/process
		*/
		//vnode(vnode) { }

		/** Hook invoked after a component is mounted. */
		// afterMount(component) { }

		/** Hook invoked after the DOM is updated with a component's latest render. */
		// afterUpdate(component) { }

		/** Hook invoked immediately before a component is unmounted. */
		// beforeUnmount(component) { }
	};

	let stack = [];

	let EMPTY_CHILDREN = [];

	/**
	 * JSX/hyperscript reviver.
	 * @see http://jasonformat.com/wtf-is-jsx
	 * Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
	 *
	 * Note: this is exported as both `h()` and `createElement()` for compatibility reasons.
	 *
	 * Creates a VNode (virtual DOM element). A tree of VNodes can be used as a lightweight representation
	 * of the structure of a DOM tree. This structure can be realized by recursively comparing it against
	 * the current _actual_ DOM structure, and applying only the differences.
	 *
	 * `h()`/`createElement()` accepts an element name, a list of attributes/props,
	 * and optionally children to append to the element.
	 *
	 * @example The following DOM tree
	 *
	 * `<div id="foo" name="bar">Hello!</div>`
	 *
	 * can be constructed using this function as:
	 *
	 * `h('div', { id: 'foo', name : 'bar' }, 'Hello!');`
	 *
	 * @param {string} nodeName	An element name. Ex: `div`, `a`, `span`, etc.
	 * @param {Object} attributes	Any attributes/props to set on the created element.
	 * @param rest			Additional arguments are taken to be children to append. Can be infinitely nested Arrays.
	 *
	 * @public
	 */
	function h(nodeName, attributes) {
		let children = EMPTY_CHILDREN,
			lastSimple,
			child,
			simple,
			i;

		for (i = arguments.length; i-- > 2;) {
			stack.push(arguments[i]);
		}
		if (attributes && attributes.children != null) {
			if (!stack.length) stack.push(attributes.children);
			delete attributes.children;
		}
		while (stack.length) {
			// 如果child是一个数组的情况处理,就push到栈的最后增加stack的长度，保证每一个child最后都被处理
			if ((child = stack.pop()) && child.pop !== undefined) {
				for (i = child.length; i--;) {
					stack.push(child[i]);
				}
			}
 else {
				if (typeof child === 'boolean') child = null;
				// 基本类型都转换为string
				if (simple = typeof nodeName !== 'function') {
					if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
				}

				if (simple && lastSimple) {
					children[children.length - 1] += child;
				}
 else if (children === EMPTY_CHILDREN) {
					children = [child];
				}
 else {
					children.push(child);
				}

				lastSimple = simple;
			}
		}

		let p = new VNode();
		p.nodeName = nodeName;
		p.children = children;
		p.attributes = attributes == null ? undefined : attributes;
		p.key = attributes == null ? undefined : attributes.key;

		// if a "vnode hook" is defined, pass every created VNode to it
		if (options.vnode !== undefined) options.vnode(p); // 不知道干嘛用的

		return p;
	}

	/**
	 *  Copy all properties from `props` onto `obj`.
	 *  @param {Object} obj		Object onto which properties should be copied.
	 *  @param {Object} props	Object from which to copy properties.
	 *  @returns obj
	 *  @private
	 */
	function extend(obj, props) {
		for (let i in props) {
			obj[i] = props[i];
		} return obj;
	}

	/**
	 * Call a function asynchronously, as soon as possible. Makes
	 * use of HTML Promise to schedule the callback if available,
	 * otherwise falling back to `setTimeout` (mainly for IE<11).
	 *
	 * @param {Function} callback
	 */
	let defer = typeof Promise === 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;

	/**
	 * Clones the given VNode, optionally adding attributes/props and replacing its children.
	 * @param {VNode} vnode		The virutal DOM element to clone
	 * @param {Object} props	Attributes/props to add when cloning
	 * @param {VNode} rest		Any additional arguments will be used as replacement children.
	 */
	function cloneElement(vnode, props) {
		return h(vnode.nodeName, extend(extend({}, vnode.attributes), props), arguments.length > 2 ? [].slice.call(arguments, 2) : vnode.children);
	}

	// DOM properties that should NOT have "px" added when numeric
	let IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

	/** Managed queue of dirty components to be re-rendered */

	let items = [];
	// 为什么这种函数对component就没有做边界值处理？
	function enqueueRender(component) {
		// component._dirty为false且items原本为空数组就能渲染
		if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
			(options.debounceRendering || defer)(rerender); //异步的执行render，要执行render方法的component中的_dirty设为true
		}
	}

	function rerender() {
		let p,
			list = items;
		items = [];
		while (p = list.pop()) {
			if (p._dirty) renderComponent(p);
		}
	}

	/**
	 * Check if two nodes are equivalent.
	 *
	 * @param {Node} node			DOM Node to compare
	 * @param {VNode} vnode			Virtual DOM node to compare
	 * @param {boolean} [hyrdating=false]	If true, ignores component constructors when comparing.
	 * @private
	 */
	// 如果虚拟dom是一个string或number，真实dom是一个文本节点；则返回true
	function isSameNodeType(node, vnode, hydrating) {
		if (typeof vnode === 'string' || typeof vnode === 'number') {
			return node.splitText !== undefined;
		}
		if (typeof vnode.nodeName === 'string') {         // 是一个节点的情况
			return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
		}
		return hydrating || node._componentConstructor === vnode.nodeName;
	}

	/**
	 * Check if an Element has a given nodeName, case-insensitively.
	 *
	 * @param {Element} node	A DOM Element to inspect the name of.
	 * @param {String} nodeName	Unnormalized name to compare against.
	 */
	function isNamedNode(node, nodeName) {
		return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
	}

	/**
	 * Reconstruct Component-style `props` from a VNode.
	 * Ensures default/fallback values from `defaultProps`:
	 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
	 *
	 * @param {VNode} vnode
	 * @returns {Object} props
	 */
	// 根据组件的props和默认的props；拿到props
	function getNodeProps(vnode) {
		let props = extend({}, vnode.attributes);
		props.children = vnode.children;

		let defaultProps = vnode.nodeName.defaultProps;
		if (defaultProps !== undefined) {
			for (let i in defaultProps) {
				if (props[i] === undefined) {
					props[i] = defaultProps[i];
				}
			}
		}

		return props;
	}

	/** Create an element with the given nodeName.
	 *	@param {String} nodeName
	 *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
	 *	@returns {Element} node
	 */
	function createNode(nodeName, isSvg) {
		let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
		node.normalizedNodeName = nodeName;
		return node;
	}

	/** Remove a child node from its parent if attached.
	 *	@param {Element} node		The node to remove
	 */
	function removeNode(node) { // 没有验证node是否为空，react里面不知道是否验证了
		let parentNode = node.parentNode;
		if (parentNode) parentNode.removeChild(node);
	}

	/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
	 *	If `value` is `null`, the attribute/handler will be removed.
	 *	@param {Element} node	An element to mutate
	 *	@param {string} name	The name/key to set, such as an event or attribute name
	 *	@param {any} old	The last value that was set for this name/node pair
	 *	@param {any} value	An attribute value, such as a function to be used as an event handler
	 *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
	 *	@private
	 */
	function setAccessor(node, name, old, value, isSvg) {
		if (name === 'className') name = 'class';

		if (name === 'key') {
			// ignore
		}
 else if (name === 'ref') {
			if (old) old(null);
			if (value) value(node);
		}
 else if (name === 'class' && !isSvg) {
			node.className = value || '';
		}
 else if (name === 'style') {
			if (!value || typeof value === 'string' || typeof old === 'string') { // 老的是字符串，新的是对象；这基本等于没啥用
				node.style.cssText = value || '';
			}
			if (value && typeof value === 'object') {   // 老的有，新的没有；就设置为空串
				if (typeof old !== 'string') {
					for (var i in old) {
						if (!(i in value)) node.style[i] = '';
					}
				}
				for (var i in value) {      // 新的所有的都重新设置
					node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? value[i] + 'px' : value[i];
				}
			}
		}
 else if (name === 'dangerouslySetInnerHTML') {
			if (value) node.innerHTML = value.__html || '';
		}
 else if (name[0] == 'o' && name[1] == 'n') {
			let useCapture = name !== (name = name.replace(/Capture$/, ''));
			name = name.toLowerCase().substring(2);
			if (value) {
				if (!old) node.addEventListener(name, eventProxy, useCapture);      // 有新的，没有老的
			}
 else {
				node.removeEventListener(name, eventProxy, useCapture);     // 没有新的，可能有老的；可能没有老的
			}
			(node._listeners || (node._listeners = {}))[name] = value; // 新的，老的都有的话只替换函数；不改变属性
		}
 else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {  // list和type为什么要特殊处理？
			setProperty(node, name, value == null ? '' : value);
			if (value == null || value === false) node.removeAttribute(name);
		}
 else {
			let ns = isSvg && name !== (name = name.replace(/^xlink\:?/, ''));
			if (value == null || value === false) {
				if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
			}
 else if (typeof value !== 'function') {
				if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
			}
		}
	}

	/** Attempt to set a DOM property to the given value.
	 *	IE & FF throw for certain property-value combinations.
	 */
	function setProperty(node, name, value) {
		try {
			node[name] = value;
		}
 catch (e) {}
	}

	/** Proxy an event to hooked event handlers
	 *	@private
	 */
	function eventProxy(e) {
		return this._listeners[e.type](options.event && options.event(e) || e);
	}

	/** Queue of components that have been mounted and are awaiting componentDidMount */
	let mounts = [];

	/** Diff recursion count, used to track the end of the diff cycle. */
	let diffLevel = 0;

	/** Global flag indicating if the diff is currently within an SVG */
	let isSvgMode = false;

	/** Global flag indicating if the diff is performing hydration */
	let hydrating = false;

	/** Invoke queued componentDidMount lifecycle methods */
	function flushMounts() {
		let c;
		while (c = mounts.pop()) {
			if (options.afterMount) options.afterMount(c);
			if (c.componentDidMount) c.componentDidMount();
		}
	}

	/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
	 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
	 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
	 *	@returns {Element} dom			The created/mutated element
	 *	@private
	 */
	function diff(dom, vnode, context, mountAll, parent, componentRoot) {
		// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
		if (!diffLevel++) { // 应该是比较节点的第一级、第二级、第三级吧
			// when first starting the diff, check if we're diffing an SVG or within an SVG
			isSvgMode = parent != null && parent.ownerSVGElement !== undefined;

			// hydration is indicated by the existing element to be diffed not having a prop cache
			hydrating = dom != null && !('__preactattr_' in dom);
		}
		// 返回的是一个真实的dom节点
		let ret = idiff(dom, vnode, context, mountAll, componentRoot);

		// append the element if its a new parent
		if (parent && ret.parentNode !== parent) parent.appendChild(ret);

		// diffLevel being reduced to 0 means we're exiting the diff
		if (! --diffLevel) {
			hydrating = false;
			// invoke queued componentDidMount lifecycle methods
			if (!componentRoot) flushMounts();
		}

		return ret;
	}

	/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
	// dom: vnode对应dom
	// dom对应render中merge,不知道是干嘛用的;是一个真实的dom节点
	// idiff 要返回一个dom树
	function idiff(dom, vnode, context, mountAll, componentRoot) {
		let out = dom,
			prevSvgMode = isSvgMode;

			// empty values (null, undefined, booleans) render as empty Text nodes
		if (vnode == null || typeof vnode === 'boolean') vnode = '';

		// Fast case: Strings & Numbers create/update Text nodes.
		// 在dom为undefined的情况下，就是创建一个textnode；并设置了['__preactattr_']属性
		if (typeof vnode === 'string' || typeof vnode === 'number') {

			// update if it's already a Text node:
			if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
				/* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
				if (dom.nodeValue != vnode) {
					dom.nodeValue = vnode;
				}
			}
 else {
				// it wasn't a Text node: replace it with one and recycle the old Element
				out = document.createTextNode(vnode);
				if (dom) {
					if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
					recollectNodeTree(dom, true);
				}
			}

			out.__preactattr_ = true; // 属性已经设置完毕，就设置为true?

			return out;
		}

		// If the VNode represents a Component, perform a component diff:
		let vnodeName = vnode.nodeName;
		if (typeof vnodeName === 'function') {
			return buildComponentFromVNode(dom, vnode, context, mountAll);
		}

		// Tracks entering and exiting SVG namespace when descending through the tree.
		isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

		// If there's no existing element or it's the wrong type, create a new one:
		vnodeName = String(vnodeName);
		// 如果不存在dom对象，或者dom的nodeName和vnodeName不一样的情况下
		if (!dom || !isNamedNode(dom, vnodeName)) {
			out = createNode(vnodeName, isSvgMode);

			if (dom) {
				// move children into the replacement node
				while (dom.firstChild) {
					out.appendChild(dom.firstChild);
				} // if the previous Element was mounted into the DOM, replace it inline
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

				// recycle the old element (skips non-Element node types)
				recollectNodeTree(dom, true);   //已经替换掉了，这一步有什么用?
			}
		}
		// 这个时候子节点应该都没东西才对，因为out是刚创建的
		let fc = out.firstChild,
			props = out.__preactattr_,
			vchildren = vnode.children;
			// 把dom节点的attributes都放在了dom['__preactattr_']上
		if (props == null) {
			props = out.__preactattr_ = {};
			for (let a = out.attributes, i = a.length; i--;) {
				props[a[i].name] = a[i].value;
			}
		}

		// 如果vchildren只有一个节点，且是textnode节点时的优化
		// Optimization: fast-path for elements containing a single TextNode:
		if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
			if (fc.nodeValue != vchildren[0]) {
				fc.nodeValue = vchildren[0];
			}
		}
		// otherwise, if there are existing or new children, diff them:
		else if (vchildren && vchildren.length || fc != null) {
			innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
		}

		// Apply attributes/props from VNode to the DOM Element:
		diffAttributes(out, vnode.attributes, props);

		// restore previous SVG mode: (in case we're exiting an SVG namespace)
		isSvgMode = prevSvgMode;

		return out;
	}

	/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
	 *	@param {Element} dom			Element whose children should be compared & mutated
	 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
	 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
	 *	@param {Boolean} mountAll
	 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
	 */
	function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
		let originalChildren = dom.childNodes,
			children = [],
			keyed = {},
			keyedLen = 0,
			min = 0,
			len = originalChildren.length,
			childrenLen = 0,
			vlen = vchildren ? vchildren.length : 0,
			j,
			c,
			f,
			vchild,
			child;

			// Build up a map of keyed children and an Array of unkeyed children:
		if (len !== 0) {
			for (var i = 0; i < len; i++) {
				var _child = originalChildren[i],
					props = _child.__preactattr_,
					key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
				if (key != null) {
					keyedLen++;
					keyed[key] = _child;
				}
 else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
					children[childrenLen++] = _child;
				}
			}
		}
		// 遍历虚拟dom节点
		// 取child(有key,证明它两个是要对应比较的)
		// 如果child和originchildren[i]比较
		// originchild没有，多余，否则插入到originchild前面
		if (vlen !== 0) {
			for (var i = 0; i < vlen; i++) {
				vchild = vchildren[i];
				child = null;

				// attempt to find a node based on key matching
				var key = vchild.key;
				if (key != null) {
					if (keyedLen && keyed[key] !== undefined) {
						child = keyed[key];
						keyed[key] = undefined;
						keyedLen--;
					}
				}
				// attempt to pluck a node of the same type from the existing children
				else if (!child && min < childrenLen) {
					for (j = min; j < childrenLen; j++) { //从min往后开始遍历,如果是相同类型的节点就拿出来,那个位置设为undefined
						if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
							child = c;
							children[j] = undefined;
							if (j === childrenLen - 1) childrenLen--;  // 如果j是最后一位，就直接删除了
							if (j === min) min++;   // 改变min  应该不需要判断
							break;
						}
					}
				}

				// morph the matched/found/created DOM child to match vchild (deep)
				child = idiff(child, vchild, context, mountAll);
				f = originalChildren[i];
				if (child && child !== dom && child !== f) {
					if (f == null) {
						dom.appendChild(child);
					}
 else if (child === f.nextSibling) {
						removeNode(f);           // 因为f有nextSibling,所以可以直接删除
					}
 else {
						dom.insertBefore(child, f);
					}
				}
			}
		}

		// remove unused keyed children:
		// keyedLen标识老的集合中还有的元素，但没在新的集合中使用
		if (keyedLen) {
			for (var i in keyed) {
				if (keyed[i] !== undefined) recollectNodeTree(keyed[i], false);
			}
		}

		// remove orphaned unkeyed children:
		// min代表拿走的元素
		while (min <= childrenLen) {
			if ((child = children[childrenLen--]) !== undefined) recollectNodeTree(child, false);
		}
	}

	/** Recursively recycle (or just unmount) a node and its descendants.
	 *	@param {Node} node						DOM node to start unmount/removal from
	 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
	 */
	function recollectNodeTree(node, unmountOnly) { // 卸载dom树
		let component = node._component;
		if (component) {    // 如果有子组件，就卸载子组件；那这个dom节点不做处理吗
			// if node is owned by a Component, unmount that component (ends up recursing back here)
			unmountComponent(component);
		}
 else {
			// If the node's VNode had a ref function, invoke it with null here.
			// (this is part of the React spec, and smart for unsetting references)
			if (node.__preactattr_ != null && node.__preactattr_.ref) node.__preactattr_.ref(null);

			if (unmountOnly === false || node.__preactattr_ == null) {   // 如果node是组件，就不执行remoeNode
				removeNode(node);
			}

			removeChildren(node);
		}
	}

	/** Recollect/unmount all children.
	 *	- we use .lastChild here because it causes less reflow than .firstChild
	 *	- it's also cheaper than accessing the .childNodes Live NodeList
	 */
	// 如果是一个树型的dom树，可能什么事都没做 removeChildren => recollectNodeTree => removeChildren
	// 除非它的子dom节点中有_component对应一个组件，但是应该不可能；因为父dom节点都没对应一个_component
	// dom._component应该是在最上层的dom节点上设置的
	function removeChildren(node) {
		node = node.lastChild;
		while (node) {
			let next = node.previousSibling;
			recollectNodeTree(node, true);  //没看懂为什么用true
			node = next;
		}
	}

	/** Apply differences in attributes from a VNode to the given DOM Element.
	 *	@param {Element} dom		Element with attributes to diff `attrs` against
	 *	@param {Object} attrs		The desired end-state key-value attribute pairs
	 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
	 */
	function diffAttributes(dom, attrs, old) {
		let name;

		// remove attributes no longer present on the vnode by setting them to undefined
		for (name in old) {
			if (!(attrs && attrs[name] != null) && old[name] != null) {     // 没有新的或新的不存在，老的有，删除老的
				setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
			}
		}

		// add new & update changed attributes
		for (name in attrs) {
			if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
				setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
			}
		}
	}

	/** Retains a pool of Components for re-use, keyed on component name.
	 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
	 *	@private
	 */
	let components = {};

	/** Reclaim a component for later re-use by the recycler. */
	// 卸载的时候收集   在什么时候重新利用的？
	function collectComponent(component) {
		let name = component.constructor.name;  // 这个时候props和state还在，所以重新利用的时候是怎么回事？
		(components[name] || (components[name] = [])).push(component);
	}

	/** Create a component. Normalizes differences between PFC's and classful Components. */
	// Ctor: 对应上面的nodeName, props: 对应props, context空对象
	// 创建出对应的组件实例
	function createComponent(Ctor, props, context) {
		let list = components[Ctor.name],
			inst;

		if (Ctor.prototype && Ctor.prototype.render) {
			inst = new Ctor(props, context);
			Component.call(inst, props, context); // 开发者忘继承了，帮你继承一下。
		}
 else { // 对应函数组件的方法吗？
			inst = new Component(props, context);
			inst.constructor = Ctor;
			inst.render = doRender;
		}

		if (list) {
			for (let i = list.length; i--;) {
				if (list[i].constructor === Ctor) {
					inst.nextBase = list[i].nextBase;
					list.splice(i, 1);
					break;
				}
			}
		}
		return inst;
	}

	/** The `.render()` method for a PFC backing instance. */
	function doRender(props, state, context) {
		return this.constructor(props, context);
	}

	/** Set a component's `props` (generally derived from JSX attributes).
	 *	@param {Object} props
	 *	@param {Object} [opts]
	 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
	 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
	 */
	function setComponentProps(component, props, opts, context, mountAll) {
		if (component._disable) return;
		component._disable = true;

		if (component.__ref = props.ref) delete props.ref;
		if (component.__key = props.key) delete props.key;
		// 如果组件没有被渲染过，或者确定要自上而下要完全重新渲染
		if (!component.base || mountAll) {
			if (component.componentWillMount) component.componentWillMount();
		}
 else if (component.componentWillReceiveProps) {
			component.componentWillReceiveProps(props, context);
		}

		if (context && context !== component.context) {
			if (!component.prevContext) component.prevContext = component.context;
			component.context = context;
		}
		// 可能是第一次渲染，也可能是回收；再渲染的
		if (!component.prevProps) component.prevProps = component.props;
		component.props = props;        // 直接更改props的指针

		component._disable = false;

		if (opts !== 0) {
			if (opts === 1 || options.syncComponentUpdates !== false || !component.base) {
				renderComponent(component, 1, mountAll);
			}
 else {
				enqueueRender(component);
			}
		}

		if (component.__ref) component.__ref(component);
	}

	/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
	 *	@param {Component} component
	 *	@param {Object} [opts]
	 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
	 *	@private
	 */
	// 写出这个函数大体做了什么
	function renderComponent(component, opts, mountAll, isChild) {
		if (component._disable) return;     // _disable判断组件是否能render

		if (mountAll){
			; // 看看什么情况下mountAll为true
		}

		let props = component.props,
			state = component.state,
			context = component.context,
			previousProps = component.prevProps || props,
			previousState = component.prevState || state,
			previousContext = component.prevContext || context,
			isUpdate = component.base,                  // 当前组件dom已经被渲染
			nextBase = component.nextBase,              // nextBase应该是在unmountComponent中被创建的
			initialBase = isUpdate || nextBase,            // component.base || component.nextBase
			initialChildComponent = component._component,   // 指向根子组件的实例
			skip = false,                                       //控制是否执行render方法
			rendered,
			inst,
			cbase;

			// 组件是否已经创建过, 判断skip; 或者调用component.componentWillUpdate
		if (isUpdate) {
			component.props = previousProps;        // 如果是已经创建过的先回退props state  context
			component.state = previousState;
			component.context = previousContext;
			if (opts !== 2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {    // 在哪里调用componentWillReceiveProps了？
				skip = true;
			}
 else if (component.componentWillUpdate) {
				component.componentWillUpdate(props, state, context);
			}
			component.props = props;
			component.state = state;
			component.context = context;
		}
		// 执行完willUpdate之后，这些pre的值就没用了；设为null
		component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
		component._dirty = false;

		if (!skip) {
			rendered = component.render(props, state, context);  // 拿到包括子虚拟dom树

			// context to pass to the child, can be updated via (grand-)parent component
			if (component.getChildContext) {
				context = extend(extend({}, context), component.getChildContext());     // 合并父组件和子组件共有的context
			}

			let childComponent = rendered && rendered.nodeName,
				toUnmount,
				base;
			// 如果子组件还是一个组件,要先渲染子组件
			if (typeof childComponent === 'function') {
				// set up high order component link
				let childProps = getNodeProps(rendered);
				inst = initialChildComponent;           // component._component

				if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {  // 子组件的key和构造函数都没变
					setComponentProps(inst, childProps, 1, context, false);
				}
 else {    // 变了就重新创建实例，设置实例的nextBase;设置实例的_parentComponent;设置实例的属性，然后渲染
					toUnmount = inst;

					component._component = inst = createComponent(childComponent, childProps, context); // 创建子组件，并挂载在component._component上
					inst.nextBase = inst.nextBase || nextBase;      // 创建组件的时候会创建nextBase？//nextBase到底是干嘛用的?
					inst._parentComponent = component;              // 实例的父组件指向_parentComponent, 所以_component与_parentComponent分别的作用是什么？
					setComponentProps(inst, childProps, 0, context, false);
					console.log('mountAll', mountAll);
					renderComponent(inst, 1, mountAll, true);
				}

				base = inst.base;                       // 将base设置为子组件的base
			}
 else {
				cbase = initialBase;

				// destroy high order component link
				toUnmount = initialChildComponent;  // component._component
				if (toUnmount) {                    // 从组件替换为dom节点了
					cbase = component._component = null;    //如果以前的子是一个组件cbase就没什么用了
				}

				if (initialBase || opts === 1) {    // 渲染dom节点
					if (cbase) cbase._component = null;
					// 应该是这个地方创建出完整的节点及子节点
					console.log('mountAll', mountAll);
					base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
				}
			}
			// 子组件不管是组件还是dom节点都要经历的过程
			if (initialBase && base !== initialBase && inst !== initialChildComponent) {   // 新渲染出的东西与老的有变化？ inst !== initialChildComponent这句判断感觉没什么必要
				let baseParent = initialBase.parentNode;
				if (baseParent && base !== baseParent) {
					baseParent.replaceChild(base, initialBase);     // 替换两个节点

					if (!toUnmount) {
						initialBase._component = null;              // 切断老节点与子节点的关系
						recollectNodeTree(initialBase, false);      // 回收老的节点
					}
				}
			}

			if (toUnmount) {        // 子组件如果是一个组件的话就调用
				unmountComponent(toUnmount);
			}

			component.base = base;  // base是渲染出的dom

			if (base && !isChild) {
				let componentRef = component,
					t = component;
				while (t = t._parentComponent) {    // 有父组件的话，向上回溯；将父组件的base设置为当前的base
					(componentRef = t).base = base;
				}
				base._component = componentRef;     // 所以base的_component也指向最上方的constructor
				base._componentConstructor = componentRef.constructor;  // base的_componentConstructor指向最上方组件的constructor
			}
		}

		if (!isUpdate || mountAll) {            // 保存组件到一个数组，以便同时执行componentDidMount
			mounts.unshift(component);          // 在flushMounts里面是pop,当前先进的先执行；保证了先执行父亲，再执行孩子
		}
 else if (!skip) {
			// Ensure that pending componentDidMount() hooks of child components
			// are called before the componentDidUpdate() hook in the parent.
			// Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
			// flushMounts();

			if (component.componentDidUpdate) {
				component.componentDidUpdate(previousProps, previousState, previousContext);
			}
			if (options.afterUpdate) options.afterUpdate(component);
		}

		if (component._renderCallbacks != null) {
			while (component._renderCallbacks.length) {
				component._renderCallbacks.pop().call(component);
			}
		}

		if (!diffLevel && !isChild) flushMounts();
	}

	/** Apply the Component referenced by a VNode to the DOM.
	 *	@param {Element} dom	The DOM node to mutate
	 *	@param {VNode} vnode	A Component-referencing VNode
	 *	@returns {Element} dom	The created/mutated element
	 *	@private
	 */
	function buildComponentFromVNode(dom, vnode, context, mountAll) {
		let c = dom && dom._component,
			originalComponent = c,
			oldDom = dom,
			isDirectOwner = c && dom._componentConstructor === vnode.nodeName,  //是不是还是这个组件
			isOwner = isDirectOwner,
			props = getNodeProps(vnode);
		;
		while (c && !isOwner && (c = c._parentComponent)) { // 没看懂
			isOwner = c.constructor === vnode.nodeName;
		}

		if (c && isOwner && (!mountAll || c._component)) {
			setComponentProps(c, props, 3, context, mountAll);
			dom = c.base;
		}
 else {
			if (originalComponent && !isDirectOwner) {
				unmountComponent(originalComponent);
				dom = oldDom = null;
			}

			c = createComponent(vnode.nodeName, props, context);
			if (dom && !c.nextBase) {
				c.nextBase = dom;
				// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
				oldDom = null;
			}
			setComponentProps(c, props, 1, context, mountAll);
			dom = c.base;

			if (oldDom && dom !== oldDom) {
				oldDom._component = null;
				recollectNodeTree(oldDom, false);
			}
		}

		return dom;
	}

	/** Remove a component from the DOM and recycle it.
	 *	@param {Component} component	The Component instance to unmount
	 *	@private
	 */
	// 调用生命周期方法，递归卸载组件或节点；收集组件，清掉ref。
	function unmountComponent(component) {
		if (options.beforeUnmount) options.beforeUnmount(component);

		let base = component.base;  //component.base是离组件最近的dom节点

		component._disable = true;

		if (component.componentWillUnmount) component.componentWillUnmount();

		component.base = null;

		// recursively tear down & recollect high-order component children:
		let inner = component._component;   // 指向子组件的实例， 只可能有一个根组件
		if (inner) {            // 如果孩子是子组件的话，只要向下递归的卸载子组件就好了
			unmountComponent(inner);
		}
 else if (base) {
			if (base.__preactattr_ && base.__preactattr_.ref) base.__preactattr_.ref(null);

			component.nextBase = base;  // 卸载一个组件后，设置了组件的nextBase为base；应该和回收后，再利用有关

			removeNode(base);    // 为什么不是直接调用remove整个tree？
			collectComponent(component);

			removeChildren(base);   // 孩子往下如果有组件就会被卸载，否则没啥用
		}

		if (component.__ref) component.__ref(null);
	}

	/** Base Component class.
	 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
	 *	@public
	 *
	 *	@example
	 *	class MyFoo extends Component {
	 *		render(props, state) {
	 *			return <div />;
	 *		}
	 *	}
	 */
	function Component(props, context) {
		this._dirty = true;

		/** @public
		*	@type {object}
		*/
		this.context = context;

		/** @public
		*	@type {object}
		*/
		this.props = props;

		/** @public
		*	@type {object}
		*/
		this.state = this.state || {};
	}

	extend(Component.prototype, {

		/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
		*	@param {object} nextProps
		*	@param {object} nextState
		*	@param {object} nextContext
		*	@returns {Boolean} should the component re-render
		*	@name shouldComponentUpdate
		*	@function
		*/

		/** Update component state by copying properties from `state` to `this.state`.
		*	@param {object} state		A hash of state properties to update with new values
		*	@param {function} callback	A function to be called once component state is updated
		*/
		setState: function setState(state, callback) {
			let s = this.state;
			if (!this.prevState) this.prevState = extend({}, s);
			extend(s, typeof state === 'function' ? state(s, this.props) : state);
			if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
			enqueueRender(this);
		},


		/** Immediately perform a synchronous re-render of the component.
		*	@param {function} callback		A function to be called after component is re-rendered.
		*	@private
		*/
		forceUpdate: function forceUpdate(callback) {
			console.log('forceUpdate');
			if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
			renderComponent(this, 2);
		},


		/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
		*	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
		*	@param {object} props		Props (eg: JSX attributes) received from parent element/component
		*	@param {object} state		The component's current state
		*	@param {object} context		Context object (if a parent component has provided context)
		*	@returns VNode
		*/
		render: function render() {}
	});

	/** Render JSX into a `parent` Element.
	 *	@param {VNode} vnode		A (JSX) VNode to render
	 *	@param {Element} parent		DOM element to render into
	 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
	 *	@public
	 *
	 *	@example
	 *	// render a div into <body>:
	 *	render(<div id="hello">hello!</div>, document.body);
	 *
	 *	@example
	 *	// render a "Thing" component into #foo:
	 *	const Thing = ({ name }) => <span>{ name }</span>;
	 *	render(<Thing name="one" />, document.querySelector('#foo'));
	 */
	function render(vnode, parent, merge) {
		return diff(merge, vnode, {}, false, parent, false);
	}

	let preact = {
		h,
		createElement: h,
		cloneElement,
		Component,
		render,
		rerender,
		options
	};

	if (typeof module !== 'undefined') module.exports = preact;else self.preact = preact;
}());
//# sourceMappingURL=preact.dev.js.map
