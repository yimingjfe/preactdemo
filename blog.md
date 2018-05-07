# 帮你读懂preact的源码 #

本篇文章希望能成为学习preact源码最友好文章，在最开始我会先介绍preact整体流程，帮助您有一个整体概念，以便不会陷入源码的细枝末节里，然后会分别讲解preact各个值得学习的机制。

作为一名前端，我们需要深入学习react的运行机制，但是react源码量已经相当庞大，从学习的角度，性价比不高，所以学习一个react mini库是一个深入学习react的一个不错的方法。

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

如果nodeName是一个字符串:

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
```



