渲染一个节点都做了什么？

- 创建节点
- 父节点与要求的父节点不符
- 则append进去

渲染一个组件都做了什么？

- 创建组件实例
- 设置组件的属性
- 调用组件的render方法，得到一个虚拟dom集合
- 调用diff方法拿到生成的dom树(diff中是调用了idff拿到真实的dom节点)
- 调用idff创建根dom节点
- 调用innerDiffNode传递了out和vchildren
- 为out的每个子节点调用了idff,生成的每个节点被dom append

setState之后做了什么？

- 调用setState,设置prevState,及state
- 调用enqueueRender，等所有同步代码执行完（包括所有的setState）；执行renderComponent
- 执行完组件的willUpdate方法和render方法拿到整个虚拟dom树，然后再执行diff方法
- 执行innerDiffNode方法
- 在innerDiffNode中递归地执行idff方法

## 读renderComponent ##

### renderComponent的opts作用 ###

renderComponent(component, opts, mountAll, isChild)

- 在renderComponent中调用，渲染子组件；传入的是1  renderComponent(inst, 1, mountAll, true);
- 在forceUpdate中调用传入的是2。       renderComponent(this, 2);       所以此时都不执行shouldComponentUpdate
- 在rerender中调用，什么都没传入。                     rerender(p)
- 在 setComponentProps 中调用，传入的是1.                renderComponent(component, 1, mountAll);

所以opts有0 1 2三种值

```
// 各种渲染模式

export const NO_RENDER = 0; //不渲染
export const SYNC_RENDER = 1;//React.render就是同步
export const FORCE_RENDER = 2;//forceUpdate
export const ASYNC_RENDER = 3;//组件的更新是异步
```

### mountAll的作用

mountAll为true的时候，mounts.unshift(component)

所以在调用 forceUpdate 之后，子组件的mountAll是不是也都为false？即forceUpdate和rerender调用时，避免了执行mounts.unshift(component)方法。

第一次的时候mountAll为什么也为false？ mountAll应该是强制让一个组件完全重新渲染

mountAll决定了是否调用componentWillMount和componentDidMount生命周期钩子函数

### renderComponent 的大致流程

是否是更新的组件

- 是，调用该调用的生命周期钩子
- 是否需要重新渲染，
  - 需要重新渲染
    - 子组件是不是组件，是的话；渲染子组件
      - 子组件的类型与老的子组件的类型是不是同一个类型？如果是同一个类型，只需要setComponentProps。
      - 创建子组件的实例，setComponentProps，renderComponent。
    - 不是的话，diff处理
  - 第一级的子是否有变化？如果有变化的话,就做替换，然后回收被替换掉的节点。
  - 子组件变了的话就卸载子组件。
  - 设置base，且为每一层父组件设置base。
  - 是否是第一次渲染
    - 是，走mounts处理，以便调用component.componentDidMount
    - 否，直接调用componentDidUpdate，所以此时子组件的componentDidUpdate会先被调用

MyApp._component === MySpan
MySpan._parentComponent === MyApp
MyApp.base === MySpan.base
MyApp.base === dom
dom._component === MyApp    // base的\_component会指向最上层的父组件

dom中_component有什么用？指的什么？

## 一个组件的渲染过程

- diff  将dom节点添加到父dom节点中
- idiff  返回dom节点
- buildComponentFromVNode 调用这个方法
- createComponent   创建一个组件实例
- setComponentProps  
  - renderComponent  设置了c.base
    - 调用渲染前的生命周期钩子
    - 如果是子也是一个组件的话createComponent setComponentProps 然后 renderComponent
    - 否则直接调用diff,    对dom的操作应该都在idiff中?


dom操作应该都在diff和idiff中进行的，diff做parent.appendChild操作
idiff做createNode操作,及节点比较后的替换

## preact中的idiff操作

如果vnode.nodeName为字符串或数字，判断原dom是字符串还是dom节点；然后做相应的操作

如果是组件节点，交由buildComponent方法处理

如果是普通的dom节点，且节点类型不一样的话；就把老的节点替换为新的节点，然后回收老的节点。（此时，貌似回收也没什么意义）

普通dom节点，diff子节点；diff属性，然后返回对应的dom树

### diffAttributes

与比较两个对象的属性类似。


## 回收相关的方法

recollectNodeTree

## setState之后的流程

- 调用setState
- 把组件加入到渲染队列
- 等到事件循环队列都执行完毕后，从数组里重新渲染

## 第一次渲染所做的操作

- 渲染第一个组件
- 拿到第一个组件的虚拟dom树
- 使用这虚拟dom树与undefined，再做diff
- 在idiff创造出第一层的节点
- 调用InnerDiffNode方法,在一个for循环中对每一个子child，调用idiff，拿到的节点append或insertBefore
- 返回第一层节点，整颗树被append进入document

## context的处理

context在renderComponent与setComponentProps中处理，大致是diff的时候带着上层的context，然后在每次渲染的时候取出getChildContext,然后extend合并。


###问题

- recollectNodeTree与unmountComponent的关系是什么样的？它们是如何配合的？

  - 如果孩子是组件的话，recollectNodeTree会递归地调用unmountComponent卸载子组件
  - 
- 回收后的组件再被使用的时候,props是如何清掉的；nextBase的作用？

  - 当调用buildComponentFromVNode的时候会调用setComponentProps,在setComponentProps中直接更改了props的指针
  - nextBase应该是使组件的dom节点和以下不用重新创建了

- component.base是怎么创建的，为什么都能指向最近的子节点？  

  - 在renderComponent中创建出base
  - 如果孩子是子组件；会将component.base = inst.base
  - 如果孩子是子节点，会调用diff算法创建出base

- unmountComponent都做了什么？

- base['__preactattr_']与component.props相同，只是少了children；那这里的['__preactattr_']意义何在？

- renderComponent都做了什么？

  - 组件是否是创建过的，如果是创建过的；调用shouldComponentUpdate

- 组件实例和虚拟dom树的数据结构关系？


###从preact中学到的

- 如果是字符串或者数字，在diff中貌似没有比较；直接修改。所以回去之后要对dom的操作性能做更深入的学习
- diff有哪些调用方式？没有dom的时候，生成一个dom元素；有dom的，比较之后之后返回正确的dom，然后parent将其append
- react的比较数组的方式和莱文斯坦算法比为什么性能更优？

###preact的数据结构

- component.base是对应dom节点
- dom._component对应的是component

component {
  base,
  _parentComponent,
  _component           // 最近的子组件
}

dom {
  _component, // 可能是指向最上方的父组件
}

如以下示例，a._component = b,a.base = $('#child'), $('#child')._component = a

<A>
  <B>
    <C>
      <div id="child"></div>
    </C>
  </B>
</A>


###待做

- this.props为undefined，要学习它的renderComponent方法
- 所有卸载相关的内容（待）
- setState之后的流程

## preact源码阅读 ##

### idiff函数 ###

接收dom与vnode，返回diff过的dom，然后由diff加入到dom中。

- 处理字符串
  - 有dom元素，改nodeValue
  - 根据vnode创建dom

- 处理组件（个人理解）
  - 比较类型是否一样，类型不相同，就重新创建组件，执行组件相应的生命周期钩子
  - 类型如果相同，就修改组件的属性，执行相应的生命周期钩子
  - 渲染组件
    - 判断是否需要render
    - 执行component.render
      - 如果直接子元素仍是一个组件
      - 如果直接子元素是dom节点
        - 通过diff拿到相应的dom节点
        - 替换dom节点
        - 回收老的dom节点，卸载不用的组件
  - 执行渲染后的生命周期钩子

- 处理element元素
  - 创建dom元素，把老的dom元素下的childNodes挂载的新的dom元素下（为了进行diffChildren） 
  - 将out attributes都挂载到dom['__preactattr_']
  - innerDiffNode
  - diffAttributes

## enqueueRender ##

  推迟组件的渲染时机，等所有代码执行完，再批量执行组件渲染。

## preact的事件处理方式 ##

为每个节点只添加一次事件处理函数

```
if(!oldValue) node.addEventListener(name, eventType, useCapture)

(node._listaners || node._listeners = {})[name] = value
```

## 对ref的处理 ##

## _dirty的作用是什么 ##

初始的时候_dirty为true

enqueueRender的时候_dirty会置为true

_dirty为true的时候才会执行renderComponent

render组件期间_dirty为false

作用应该是避免enqueueRender组件两次

## 对回收的处理 ##

### unmountComponent ###

- 执行生命周期钩子
- 如果孩子是组件的话，继续递归卸载
- 如果孩子是dom的话
  

### unmountDom ###


综上，可以看到在组件回收的时候，组件实例放入到了components这个map对应的数组里，实例上有nextBase,nextBase保留了整个dom树的状态

在createComponent的时候，重新找到nextBase，然后给inst.nextBase

在renderComponent的时候，调用component.render后，会用rendered与nextBase比较，返回生成的比较之后的dom节点,节省了dom节点的创建处理时间？？？


## 对setState的处理 ##

## forceUpdate与异步渲染的处理 ## 

即opts === 2 || opts === 3

## enqueueRender ##

```
let items = []
function enqueueRender(component){
  if(!component._dirty){
    defer(renderer)
  }
}

function renderer(){
  let c = null
  while(c = items.pop()){
    if(c._dirty) renderComponent(c)
  }
}
```

## 对函数组件的处理 ##

没有继承Component，是怎么处理的？

## 对HOC的处理 ##

## 服务端渲染是怎么处理的  ##

## 谈谈preact的可拓展性 ##

通过options暴露了很多钩子




