/* eslint-disable */
const ENOUGHT_TIME = 1;

const HOST_COMPONENT = "host";
const CLASS_COMPONENT = "class";
const HOST_ROOT = "root";

const updateQueue = [];
let nextUnitOfWork = null;
let pendingCommit = null;

let workQueue = []
let nextUnitOfWork = null

// Effect tags

const PLACEMENT = 1;
const DELETION = 2;
const UPDATE = 3;

function arrify(val) {
  return val == null ? [] : Array.isArray(val) ? val : [val]
}

function reconcileChildrenArray(wipFiber, newChildElements){
  const elements = arrify(newChildElements)

  let index = 0;
  let oldFiber = wipFiber.alternate ? wipFiber.alternate.child : null
  let newFiber = null
  while(index < elements.length || oldFiber != null) {
    const prevFiber = newFiber;
    const element = index < elements.length && oldFiber.type
    const sameType = oldFiber && element && element.type == oldFiber.type

    if(sameType) {
      newFiber = {
        type: oldFiber.type,
        tag: oldFiber.tag,
        staateNode: oldFiber.stateNode,
        props: element.props,
        parent: wipFiber,
        alternate: oldFiber,
        partialState: oldFiber.partialState,
        effectTag: UPDATE
      }
    }

    if(element && !sameType) {
      newFiber = {
        typr: element.type,
        tag: typeof element.type === "string" ? HOST_COMPONENT: CLASS_COMPONENT,
        props: element.props,
        parent: wipFiber,
        effectTag: PLACEMENT
      }
    }

    if(oldFiber && !sameType) {
      oldFiber.effectTag = DELETION;
      wipFiber.effects = wipFiber.effects || []
      wipFiber.effects.push(oldFiber)
    }

    if(oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if(index == 0) {
      wipFiber.child = newFiber
    } else if(prevFiber && element){
      prevFiber.sibling = newFiber
    }

    index++
  }
}

function schedule(task){
  workQueue.push(task)
  requestIdleCallback(performWork)
}

function performWork(deadline){
  workLoop(deadline)
  if(nextUnitOfWork || updateQueue.length > 0){
    requestIdleCallback(performWork)
  }
}

function workLoop(deadline) {
  if(!nextUnitOfWork){
    resetNextUnitOfWork()
  }
  while(nextUnitOfWork && deadline.timeRemaining() > ENOUGH_TIME){
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
  if(pendingCommit){
    commitAllWork(pendingCommit)
  }
}

function resetNextUnitOfWork(){
  const update = updateQueue.shift()
  if(!update) return 
  if(update.partialState){
    update.instance.__fiber.partialState = update.partialState
  }

  const root = 
    update.from == HOST_ROOT 
      ? update.dom.__rootContainerFiber
      : getRoot(update.instance.__fiber)
    
    nextUnitOfWork = {
      tag: HOST_ROOT,
      stateNode: update.dom || root.stateNode,
      props: update.newProps || root.props,
      alternate: root
    }
}

function beginWork(wipFiber) {
  if(wipFiber.tag == CLASS_COMPONENT){
    updateClassComponent(wipFiber)
  } else {
    updateHostComponent(wipFiber)
  }
}

function updateHostComponent(wipFiber){
  if(!wipFiber.stateNode){
    wipFiber.stateNode = createDomElement(wipFiber)
  }
  const newChildElements = wipFiber.prop.children
  reconcileChildrenArray(wipFiber, newChildElements)
}

function updateClassComponent(wipFiber){
  let instance = wipFiber.stateNode
  if(instance == null) {
    instance = wipFiber.stateNode = createInstance(wipFiber)
  } else if(wipFiber.props == instance.props && !wipFiber.partialState) {
    cloneChildFibers(wipFiber)
    return
  }

  instance.props = wipFiber.props
  instance.state = Object.assign({}, instance.state, wipFiber.partialState)
  wipFiber.partialState = null

  const newChildElements = wipFiber.stateNode.render()
  reconcileChildrenArray(wipFiber, newChildElements)

}

function performUnitOfWork(wipFiber){
  beginWork(wipFiber)
  if(wipFiber.child) {
    return wipFiber.child
  }

  let uow = wipFiber

  while(uow){
    completeWork(uow)
    if(uow.sibling) {
      return uow.sibling
    }
    uow = uow.parent
  }
}

function getRoot(fiber){
  let node = fiber;
  while(node.parent){
    node = node.parent
  }
  return node
}

let fiber = {
  tag: HOST_COMPONENT,  // tag分为了HOST_COMPONENT、CLASS_COMPONENT、HOST_ROOT
  type: "div",   // 与以前的type是一样的
  parent: parentFiber,
  child: childFiber,
  sibling: null,   //不应该是siblings？
  alternate: currentFiber,  // alternate是将work-in-progress bibers与老树的fiber相链接，什么意思?
  stateNode: document.createElement("div"), // 组件实例的指针
  props: { children: [], className: "foo" },
  partialState: null,
  effectTag: PLACEMENT, // effectTag, PLACEMENT, UPDATE,  DELETION
  effects: [] // 子树中所有的effectTag
}

function render(elements, containerDom){
  updateQueue.push({
    from: HOST_ROOT,
    dom: containerDom,
    newProps: { children: elements }
  })
  requestIdleCallback(perfomWork)
}

function scheduleUpdate(instance, partialState) {
  updateQueue.push({
    from: CLASS_COMPONENT,
    instance: instance,
    partialState: partialState
  })
  requestIdleCallback(performWork)
}

class Component{
  constructor(props){
    this.props = props || {}
    this.state = this.state || {}
  }

  setState(partialState){
    scheduleUpdate(this, partialState)
  }
}

function createInstance(fiber) {
  const instance = new fiber.type(fiber.props)
  instance.__fiber = fiber
  return instance
}