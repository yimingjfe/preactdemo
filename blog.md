# 帮你读懂preact的源码 #

本篇文章希望能成为学习preact源码最友好文章，在最开始我会先介绍preact整体流程，帮助您有一个整体概念，以便不会陷入源码的细枝末节里，然后会分别讲解preact各个值得学习的机制。建议与preact源码一起阅读本文。

作为一名前端，我们需要深入学习react的运行机制，但是react源码量已经相当庞大，从学习的角度，性价比不高，所以学习一个react mini库是一个深入学习react的一个不错的方法。

希望能帮你理清如下问题：

以下图是preact源码大致流程图，现在看不懂没关系，也不需要刻意记，在学习的过程中，不妨根据此图试着猜想preact每一步都做了什么，下一步要做什么。

首先说一下大家都比较熟悉的JSX，从react的官方文档中，我们可以得知，jsx内容在会被babel编译为以下格式：

```
In

const element = (
  <h1 className="greeting">
    Hello, world!
  </h1>
);
  
Out

const element = React.createElement(
  'h1',
  {className: 'greeting'},
  'Hello, world!'
);
```

这样通过createElement就可以生成虚拟dom树，在preact里面对应的函数是h。
h函数根据nodeName,attributes,children,返回一个虚拟dom树，这个虚拟dom树往往有三个属性:
```
function h(nodeName, props, ...children){
    .... // 其他代码
    return {
        nodeName,
        props,     // props中包含children
        key,       // 为diff算法做准备
    }
}
```

这里不贴出preact的源代码，因为h函数的实现方式有很多，不希望最开始的学习就陷入到细枝末节，只需要明白h函数的作用即可。

接下来我们看一下render函数，```render(<App>, container)```,在preact里面render函数很简单就是调用diff函数。

```
	function render(vnode, parent, merge) {
		return diff(merge, vnode, {}, false, parent, false);
	}
```

diff函数的主要作用是调用idiff函数，然后将idff函数返回的真实dom append到dom中
```
function diff(dom, vnode, context, mountAll, parent, componentRoot) {
    // 返回的是一个真实的dom节点
    let ret = idiff(dom, vnode, context, mountAll, componentRoot);

    // append the element if its a new parent
    if (parent && ret.parentNode !== parent) parent.appendChild(ret);
}
```

接下来我们要介绍idff函数，开启react高性能diff算法的大门，但在这之前，我们应该了解react diff算法的理论基础：

- 节点的类型不同，直接创建

idiff函数主要分为三块，分别处理vnode三种情况： 

- vnode是string或者Number,类似于上面例子的'Hello World',一般是虚拟dom树的叶子节点。
- vnode中的nodeName是一个function，即vnode对应一个组件，例如上例中的<App/>。
- vnode中nodeName是一个字符串，即vnode对应一个html元素，例如上例中的h1。

对于string或Number:

```
// 如果要比较的dom是一个textNode，直接更改dom的nodeValue
// 如果要比较的dom不是一个textNode,就创建textNode,然后回收老的节点树，回收的节点树会保留结构，然后保存在内存中，在// 需要的时候复用。（回收相关的处理会在之后详细说明）
if (typeof vnode === 'string' || typeof vnode === 'number') {

    // update if it's already a Text node:
    if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
        /* istanbul ignore if */
        /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
        if (dom.nodeValue != vnode) {
            dom.nodeValue = vnode;
        }
    } else {
        // it wasn't a Text node: replace it with one and recycle the old Element
        out = document.createTextNode(vnode);
        if (dom) {
            if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
            recollectNodeTree(dom, true);
        }
    }

    out.__preactattr_ = true;

    return out;
}
```

如果nodeName是一个function，会直接调用buildComponentFromVNode方法

```
let vnodeName = vnode.nodeName;
if (typeof vnodeName === 'function') {
    return buildComponentFromVNode(dom, vnode, context, mountAll);
}
```

如果nodeName是一个字符串，以下很长的代码，就是做三步：

- 对于类型不同的节点，直接做替换操作，不做diff比较。
- diffAttrites
- diffChildren

```
// Tracks entering and exiting SVG namespace when descending through the tree.
isSvgMode = vnodeName === 'svg' ? true : vnodeName === 'foreignObject' ? false : isSvgMode;

// If there's no existing element or it's the wrong type, create a new one:
vnodeName = String(vnodeName);
// 如果不存在dom对象，或者dom的nodeName和vnodeName不一样的情况下
if (!dom || !isNamedNode(dom, vnodeName)) {
    out = createNode(vnodeName, isSvgMode);

    if (dom) {
        // 在后面你会发现preact的diffChildren的方式，是通过把真实dom的子节点与虚拟dom的子节点相比较，所以需要老的// 孩子暂时先移动到新的节点上
        // move children into the replacement node
        while (dom.firstChild) {
            out.appendChild(dom.firstChild);
        } // if the previous Element was mounted into the DOM, replace it inline
        if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

        // recycle the old element (skips non-Element node types)
        recollectNodeTree(dom, true);
    }
}

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

// 如果vchildren只有一个节点，且是textnode节点时,直接更改nodeValue，优化性能
// Optimization: fast-path for elements containing a single TextNode:
if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
    if (fc.nodeValue != vchildren[0]) {
        fc.nodeValue = vchildren[0];
    }
}

// 比较子节点，将真实dom的children与vhildren比较
// otherwise, if there are existing or new children, diff them:
else if (vchildren && vchildren.length || fc != null) {
    innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
}

diffAttributes(out, vnode.attributes, props);

return out;
```

### 组件的diff ###

接下来我们来看preact中组件是如何做diff的,通过学习元素节点的diff操作，我们不妨大胆猜测一下，组件是做了如下diff操作：

- 组件不同类型或者不存在就创建，走相应的生命周期钩子
- 比较组件的属性
- 比较组件的孩子

事实上和我们的猜想很相似，在进行下一步之前，我们先了解下preact中的数据结构：

```
// 如下JSX
<App>
    <Child></Child>
</App>

// App组件的实例，会有以下属性

{
    base,   // 对应组件渲染的dom
    _component, // 指向Child组件
}

// Child组件有以下属性

{
    base,
    _parentComponent,   // 指向App组件
}

// 对应的dom节点，即前文中的base对象

{ 
    _component    // 指向App组件，而不是Child组件
}
```

然后我们看一下buildComponentFromVNode逻辑:

- 如果组件类型相同调用setComponentProps
- 如果组件类型不同：
    - 回收老的组件
    - 创建新的组件实例
    - 调用setComponentProps
    - 回收老的dom
- 返回dom
```
	function buildComponentFromVNode(dom, vnode, context, mountAll) {
		let c = dom && dom._component,
			originalComponent = c,
			oldDom = dom,
			isDirectOwner = c && dom._componentConstructor === vnode.nodeName, // 组件类型是否变了
			isOwner = isDirectOwner,
			props = getNodeProps(vnode);

		while (c && !isOwner && (c = c._parentComponent)) { // 如果组件类型变了，一直向上遍历；看类型是否相同
			isOwner = c.constructor === vnode.nodeName;
		}
        // 此时isOwner就代表组件类型是否相同
        // 如果组件类型相同，只设置属性；然后将dom指向c.base
		if (c && isOwner && (!mountAll || c._component)) { 
			setComponentProps(c, props, 3, context, mountAll);
			dom = c.base;
		} else {
			if (originalComponent && !isDirectOwner) {   // 组件类型不同就先卸载组件
				unmountComponent(originalComponent);
				dom = oldDom = null;
			}
            // 创建组件的主要逻辑就是return new vnode.nodeName()
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
```

可以看到组件进一步diff的核心逻辑在setComponentProps方法中,setComponentProps大致做了两件事：

- 调用渲染前的生命周期钩子： componentWillMount 与 componentWillReceiveProps
- 调用renderComponent

renderComponent主要逻辑为：

- 调用shouldComponentUpdate 或 componentWillUpdate生命周期钩子
- 调用组件的render方法
    - 如果render的结果是一个组件，做类似与buildComponentFromVNode的操作
    - 如果render的结果是dom节点，调用diff操作
- 替换新的节点，卸载老的节点或组件
- 为组件的base添加组件引用_component
- 调用组件的生命周期钩子componentDidUpdate，componentDidMount

至此，我们已经大致了解了preact的大致全流程，接下来我们看一下它的diffChildren的算法，要学习diff算法，我们首先要知道react diff算法的前提。

传统的diff两颗树的时间复杂度为O(n^3),而react中的diff算法是O(n)，基于以下前提：

- 两个不同类型的元素会产生不同的树。（就像上面源码所看到，如果类型不同，preact直接用新的节点替换老的节点，不会做进一步diff比较）
- 对于同层子节点，可以通过一个稳定的key来标识
- react的diff算法，只对同层次的节点做比较

接下来我们看以下preact中是如何diffChildren的：

- 将原始dom的子节点分为两部分，有key的放在keyed map里面，没有key的放在children数组里面。
- 遍历vchildren,通过key找到keyed中的child，如果child不存在，从children中取出相同类型的子节点
- 对child与vchild进行diff，此时得到的dom节点就是新的dom节点
- 然后与老的dom节点对应的节点比较，操作dom树。
- 最后删除新的dom树中不存在的节点。

```
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

    if (len !== 0) {
        for (var i = 0; i < len; i++) {
            var _child = originalChildren[i],
                props = _child.__preactattr_,
                key = vlen && props ? _child._component ? _child._component.__key : props.key : null;
            if (key != null) {
                keyedLen++;
                keyed[key] = _child;
            } else if (props || (_child.splitText !== undefined ? isHydrating ? _child.nodeValue.trim() : true : isHydrating)) {
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
                        if (j === childrenLen - 1) childrenLen--; 
                        if (j === min) min++; 
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
                } else if (child === f.nextSibling) {
                    removeNode(f); 
                } else {
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
```

从上面可以看出，preact只处理了常见的使用场景，没有做特别的优化措施，这也导致它在一些情况下的性能比react低，如：从a b到b a。
而react中会记录lastIndex,对其做了相应的优化，节点的Index > lastIndex的情况下，不做移动操作。
但是如果react中有length > 2，最前面的节点位置与最后面的节点位置互换的情况下，由于index一直小于lastIndex,就会失去上述的优化效果。
这种情况，在snabbdom中得到了优化，snabbdom通过oldStartIdx,oldEndIdx,newStartIdx,newEndIdx四个指针，在每次循环中优先处理特殊情况，并通过缩小指针范围，获得性能上的提升。

## preact针对性能的优化 ##

### 对回收的处理 ###

在preact中，回收调用了两个方法，dom节点的回收一般会调用recollectNodeTree，组件的回收会调用unmountComponent。

preact复用dom的秘密在于当要卸载一个组件的时候，只有组件的根节点会从父节点上卸载掉，组件完整的dom仍然存在，被卸载的组件会保存在components对象中。

在创建组件的时候又通过nodeName拿到对应的dom节点树，挂载在组件实例的inst.nextBase上,在renderComponent的时候,再diff nextBase与新的虚拟dom树rendered。

相关主要代码如下：

```
function createComponent(Ctor, props, context) {
    let list = components[Ctor.name],
        inst;

    if (Ctor.prototype && Ctor.prototype.render) {
        inst = new Ctor(props, context);
        Component.call(inst, props, context); 
    } else { // 对应函数组件
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
```

## setState的处理 ##

更改组件上的state,然后将要渲染的组件放在一个数组中，在下一次event loop的时候渲染：

```
    setState: function setState(state, callback) {
        let s = this.state;
        if (!this.prevState) this.prevState = extend({}, s);
        extend(s, typeof state === 'function' ? state(s, this.props) : state);
        if (callback)(this._renderCallbacks = this._renderCallbacks || []).push(callback);
        enqueueRender(this);
    },

    function enqueueRender(component) {
		// component._dirty为false且items原本为空数组就能渲染
		if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
			(options.debounceRendering || defer)(rerender); //异步的执行render，要执行render方法的component中的_dirty设为true
		}
	},

    function rerender() {
		let p,
			list = items;
		items = [];
		while (p = list.pop()) {
			if (p._dirty) renderComponent(p);
		}
	}
```














