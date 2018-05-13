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
- 然后与老的dom节点对应的节点比较，

preact相邻节点互换的话，性能比较低，因为第一个节点被删除了

### react的diffChildren算法 ###

a   b   c    d

b   e    d   c

遍历新的虚拟dom节点，找到对应的老的虚拟dom节点，此时lastIndex为0，所以不做任何操作，遍历到新的虚拟dom节点a，找到老的虚拟dom节点a，此时mountIndex < lastIndex,所以将a移动到b的后面。如果遇到新增的节点直接新增，最后删除那些没有被标记的节点。

### vue的diffChildren算法 ###

- 头部相同，尾部相同
- 头部与尾部相同
- 新增节点
- 需要删除的节点
- 其他节点： 3  4  5  6  7

a b f  g
                b   f   g     b   a   f   g     b  a  g
b a g  f


a  d   e
                b   a   d   e       b   e   a   d
b  e   a









