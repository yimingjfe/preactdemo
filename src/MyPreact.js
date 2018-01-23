/* eslint-disable */
const EMPTY_CHILDREN = []

const components = {}

const defer = typeof Promise === 'function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout

let mounts = []

let renderItems = []

class VNode{}

// rest和attribute.children
function h(nodeName, attributes) {
    // 当attributes是空对象的时候怎么处理？
    let stack = EMPTY_CHILDREN;
    let children = [];
    let lastSimple = false;
    for (let i = arguments.length; i-- > 2;) {
        stack.push(arguments[i]);
    }
    if (attributes && attributes.children !== null) {
        if (!stack.length) stack.push(attributes.children);
        delete attributes.children;
    }
    while (stack.length) {
        let child = stack.pop();
        if (child && child.pop !== undefined) {
            for (let i = child.length; i--;) {
                stack.push(child[i]);
            }
        } else {
            if (typeof child === 'boolean') child = null;
            if (child == null) {
                child = '';
            } else if (typeof child === 'number') {
                child = String(child);
            }

            children.push(child)
        }
    }

    let p = new VNode()
    p.nodeName = nodeName;
    p.children = children;
    p.attributes = attributes == null ? undefined : attributes;
    p.key = attributes == null ? undefined : attributes.key;

    return p
}

function removeNode(node){
    node.parentNode && node.parentNode.removeNode(node)
}

function removeChildren(node){
    node = node.lastChild
    while(node){
        let next = node.previousSibling;
        recollectNodeTree(node, true)
        node = next
    }
}

function collectComponent(component){
    const name = component.constructor.name;
    (components[name] || (components[name] = [])).push(component);
}

function unmountComponent(component){
    let base = component.base
    if(component.componentWillMount) component.componentWillMount()

    component.base = null

    let inner = component._component

    if(inner){
        unmountComponent(component._component)
    } else {
        if(base['__preactattr_'] && base['__preactattr_'].ref) base['__preactattr_'].ref(null)

        component.nextBase = base

        removeNode(base)

        collectComponent(component)

        removeChildren(base)
    }

    if(component.__ref) component.__ref(null) 
}

function recollectNodeTree(node, unmountOnly){
    if(node._component){
        unmountComponent(node)
    } else {
        removeNode(node)
    }
}

// idiff完成节点自身的比较，innerDiffNode就是比较子孩子，将子孩子加入到dom中
function innerDiffNode(dom, vchildren) {
    const originchildren = dom.children
    const keyed = {}
    const children = {}
    let min = 0
    let childrenLen = 0

    for(let i = 0; i < originchildren.length; i++){
        const child = originchildren[i]
        const key = child.key
        if(key){
            keyed[key] = child
        } else {
            children.push(child)
            childrenLen++
        }
    }

    for(let i = 0; i < vchildren.length; i++){
        const vchild = vchildren[i]
        const key = vchild.key
        let child = null
        if(key && keyed[key]){
            child = keyed[key]
            keyed[key] = undefined
        } else {
            for(let j = min; j < children.length; j++){
                if(isSameNodeType(children[j], vchild)){
                    child = children[j]
                    children[j] = undefined
                    if(j === children.length - 1) childrenLen--
                    min++
                }
            }
        }

        child = idiff(child, vchild)
        const f = originchildren[i]
        if(child && f !== child && dom !== f){
            if(f == null){
                dom.appendChild(child)
            } else if(child === f.nextSibling){
                removeNode(f)
            } else {
                dom.insertBefore(child, f);
            }
        }
    }


    for(let i in keyed){
        if(keyed[i] === undefined){
            recollectNodeTree(keyed[i], false)
        }
    }

    while(childrenLen >= min){
        if(children[childrenLen - 1] !== undefined){
            recollectNodeTree(children[childrenLen - 1], false)
        }
        childrenLen--
    }
    
}

function getNodeProps(vnode){
    var props = {...vnode.attributes}
    props.children = vnode.children;

    var defaultProps = vnode.nodeName.defaultProps
    if(defaultProps !== undefined){
        return {...props, defaultProps}
    }

    return props
}

function createComponent(Ctor, props, context){
    var inst = new Ctor(props, context)
    return inst
}

function setComponentProps(component, props){
    if(component.__ref = props.ref) delete props.ref
    if(component.__key = props.key) delete props.key
    if(!component.base){
        if(component.componentWillMount) component.componentWillMount();
    } else if (component.componentWillReceiveProps) {
        component.componentWillReceiveProps(props, context)
    }
    component.props = props;
}

// props或state变化了，调用当前方法；每次都生成一个新的实例；性能问题是如何处理的？
// 创建一个实例，实例挂载到dom上
// 调用render方法，拿到虚拟dom树；然后调用diff方法

// 创建组件实例
// 调用willMount
// 设置prevProps
// 设置props
// 渲染组件
// 获得虚拟dom树
// 调用diff，parentNode是initialBase.parentNode
function buildComponentFromVNode(dom, vnode, context){ 

    var vnodename = vnode.nodeName,
        c = null,
        props = getNodeProps(vnode);

    c = createComponent(vnodename, props, context);             //根据组件类，创建实例

    const rendered = renderComponent(c, props, context)

    return idiff(dom, rendered)
}

// 设置props，调用生命周期函数；调用渲染方法
function renderComponent(c, props, context){
    
    // 为实例设置props
    if(!c.base){
        if(c.componentWillMount) c.componentWillMount()
    } else if(c.componentWillReceiveProps){
        c.componentWillReceiveProps(props)
    }
    c.prevProps = c.props
    c.props = props
    // 调用render方法，生成虚拟dom节点的集合
    let rendered = c.render()
    mounts.push(c)          // 为了集体调用componentDidMount方法

    return rendered
}

function eventProxy(e){
    return this._listeners[e.type](e)
}

function setAccessor(node, name, value, old){
    // className key ref style dangerouslySetInnerHTML event
    if(name === 'className') name = 'class' // 设置属性class或者className的统一处理
    if(name === 'key'){

    } else if(name === 'class'){
        node.className = value || ''
    } else if(name === 'ref'){
        old(null)
        value(node)
    } else if(name === 'dangerouslySetInnerHTML'){
        node.innerHTML = value.__html || ''
    } else if(name === 'style'){
        if(!value || typeof value === 'string'){
            node.style.cssText = value || ''
        }
        if(value && typeof value === 'object'){
            if(typeof old !== 'string'){
                for(let i in old){
                    if(!(i in value)) node.style[i] = ''
                }
            } 
            for(let j in value){
                node.style[j] = typeof value[j] === 'number' ? value[j] + 'px' : value[j]    // 对px进行容错处理
            }
        }
    } else if(name.startsWith('on')) {
        name = name.slice(2).toLowerCase()
        if(!value){
            node.removeEventListener(name, eventProxy)
        }
        if(value && !old){
            node.addEventListener(name, eventProxy)
        }
        (node.listeners || (node.listeners = {}))[name] = value
    }
}

function diffAttributes(dom, attrs, old){
    for(let i in old){
        if(old[i] && !attrs[i]){
            setAccessor(dom, i, attrs[i], old[i])
        }
    }

    for(let j in attrs){
        setAccessor(dom, j, attrs[j], old[j])
    }
}

function render(vnode, parent) {
    return diff(null, vnode, parent)
}

function isSameNodeType(dom, vnode){
    return dom.nodeName === vnode.nodeName || dom.nodeName.toLowerCase() === vnode.nodeName.toLowerCase()
}

function diff(dom, vnode, parent){
    const ret = idiff(dom, vnode)
    if(parent && ret.parentNode !== parent){
        parent.appendChild(ret)
    }
    flushMounts()
    return ret
}

function flushMounts(){
    var c;
    while(c = mounts.shift()){
        c.componentDidMount && c.componentDidMount()
    }
    mounts = []
}

// 比较dom和vnode的不同，返回一个期望的dom节点
function idiff(dom, vnode) {
    let out = dom
    if(typeof vnode === 'string' || typeof vnode === 'number'){
        if(dom && dom.splitText !== undefined && dom.parentNode){
            if(dom.nodeValue != vnode){
                dom.nodeValue = vnode
            }
        } else {
            out = document.createTextNode(vnode);
            if(dom) {
                if(dom.parentNode) dom.parentNode.replaceChild(out, dom);
                // recollectNodeTree(dom, true);
            }
        }

        out['__preactattr_'] = true;
        
        return out;
    }    

    var vnodeName = vnode.nodeName;

    if(typeof vnodeName === 'function'){
        return buildComponentFromVNode(dom, vnode)
    }
        
    if(!dom || !isSameNodeType(dom, vnode)){
        out = createNode(vnode.nodeName)

        if(dom){
            while(dom.firstChild){
                out.appendChild(dom.firstChild)
            }
            if(dom.parentNode) dom.parentNode.replaceChild(dom, out)
            // 此时要回收老的元素
        }

    }

    if(vnode.children && vnode.children.length){
        innerDiffNode(out, vnode.children)
    }

    let props = out['__preactattr_'] = {}

    diffAttributes(out, vnode.attributes, props)

    return out
}

function createNode(nodeName) {
    var node = document.createElement(nodeName);
    node.normalizedNodeName = nodeName;
    return node;
}

function enqueueRender(component){
    renderItems.push(component)
    defer(rerender)
}

function rerender(){
    let c = null
    let list = renderItems
    renderItems = []
    while(c = list.pop()){
        renderComponent(c)
    }
}

function Component(props, context){
    this.props = props
    this.context = context
    this._dirty = false
}

Component.prototype.setState = function(state, callback){
    this.prevState = { ...state }
    if(callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback)
    enqueueRender(this)
}

export {
    h,
    render,
    Component
};