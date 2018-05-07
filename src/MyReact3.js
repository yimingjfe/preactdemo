/* eslint-disable */

// 增加fiber
// 判断textNode通过splitText
// 下一步，修改diff算法
// 修改事件与setState的处理方式
// 增加声明周期钩子

let rootInstance = null
let TEXTNODE = 'TEXTNODE'

function appendChild(parentDom, dom){
  typeof dom === 'object' ? parentDom.appendChild(dom) : parentDom.textContent = dom
}

function createElement(type, attributes, ...children){
  let props = {...attributes}
  children = children && children.length > 0 ? [].concat(...children) : []
  props.children = children
    .filter(child => child != null && child != false)
    // .map(child => child instanceof Object ? child : createTextElement(child))

  return {
    type,
    props: props,
  }
}

function createTextElement(value){
  return createElement(TEXTNODE, { nodeValue: value })
}

function render(elem, parentDom){
  let prevInstance = rootInstance
  let instance = diff(prevInstance, elem, parentDom)
  rootInstance = instance
}

function diff(prevInstance, elem, parentDom){
  if(!prevInstance){
    let instance = instantiate(elem)
    appendChild(parentDom, instance.dom) // 改写appendChild
    return instance
  } else if(!elem){
    parentDom.removeChild(prevInstance.dom)
  } else if(elem.type !== prevInstance.elem.type) {
    let instance = instantiate(elem)
    parentDom.replaceChild(instance.dom, prevInstance.dom)
    return instance
  } else if(typeof elem.type === 'string') { // 类型相同，且是html元素
    updateProperties(prevInstance.dom, prevInstance.elem.props, elem.props)
    prevInstance.childInstances = diffChildren(prevInstance, elem)
    prevInstance.elem = elem
    return prevInstance     // ????
  } else {
    prevInstance.publicInstance.props = elem.props
    let childElement = prevInstance.publicInstance.render()  //publicInstance

    const childInstance = diff(
      prevInstance.childInstance,
      childElement,
      parentDom
    )
    prevInstance.dom = childInstance.dom
    prevInstance.childInstance = childInstance
    prevInstance.elem = elem
    return prevInstance
  }
}

function updateProperties(dom, prevProps, props){ // 老dom的属性要删掉，新dom的属性要加上，还有一部分要替换掉，都是dom级别的操作，组件级别的在diff方法里面
  const isListener = name => name.startsWith('on');
  const isAttribute = name => name !== 'key' && !isListener(name) && name !== 'children';
  let oldAttributes = dom.attributes
  // 删除多余的，更改新的
  Object.keys(prevProps).filter(isListener).forEach(name => {
    const eventType = name.slice(2).toLowerCase()
    dom.removeEventListener(eventType, prevProps[name])
  })

  Object.keys(prevProps).filter(isAttribute).forEach(name => {
    dom[name] = null
  })  

  Object.keys(props).filter(isAttribute).forEach(name => {
    dom[name] = props[name]
  })
  Object.keys(props).filter(isListener).forEach(name => {
    const eventType = name.slice(2).toLowerCase()
    dom.addEventListener(eventType, props[name])
  })
}

function diffChildren(prevInstance, elem){
  const { childInstances } = prevInstance
  const { children } = elem.props
  let length = Math.max(childInstances.length, children.length)
  let newChildInstances = []
  for(let i = 0; i < length; i++){
    newChildInstances.push(diff(childInstances[i], children[i]))
  }
  return newChildInstances
}

function createPublicInstance(elem, instance){
  let { type, props } = elem
  let publicInstance = new type(props)
  publicInstance.internalInstance = instance
  return publicInstance
}

// 有Instance的原因，便于与新的虚拟dom树比较，便于统一处理元素与组件类型
// 每个实例都有一个dom属性，便于父dom appendChild
function instantiate(elem){
  if(typeof elem.type === 'string'){  // 普通的元素
    const { type, props } = elem
    const childElements = props.children || []
    const isTextNode = type === TEXTNODE
    console.log('elem', elem, elem.props.nodeValue)
    let dom = typeof elem === 'object' ? document.createTextNode("")   //那个项目是怎么渲染的？
      : document.createElement(type)
    updateProperties(dom, [], elem.props)
    console.log('dom', dom)
    let childInstances = childElements.map(child => {
      console.log('child', child, dom)
      return diff(null, child, dom)  
    })
    let childDoms = childInstances.map(childInstance => childInstance.dom)
    childDoms.forEach(childDom => appendChild(dom, childDom))
    return {
      dom,
      elem,
      childInstances
    }
  } else if( typeof elem === 'string'){  // 字符串虚拟dom
    return {
      dom: elem,
      elem
    }
  } else {  // 类组件
    let instance = {}
    let publicInstance = createPublicInstance(elem, instance)

    let childElement = publicInstance.render()

    let childInstance = instantiate(childElement)

    Object.assign(instance, {
      dom: childInstance.dom, 
      elem,
      publicInstance,  
      childInstance
    })
    return instance
  }
}



class Component{

  constructor(props){
    this.props = props
    this.state = this.state || {}
  }

  setState(state){
    Object.assign(this.state, {...state})
    updateInstance(this.internalInstance) // 怎么能拿到internalInstance？
  }
}

function updateInstance(internalInstance){
  const parentDom = internalInstance.dom.parentNode
  const elem = internalInstance.elem
  diff(internalInstance, elem, parentDom)
}
 
const React = {
    h: createElement,
    createElement,
    render,
    Component
}


export default React