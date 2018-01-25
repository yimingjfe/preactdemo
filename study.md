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

### mountAll的作用

mountAll为true的时候，mounts.unshift(component)

所以在调用 forceUpdate 之后，子组件的mountAll是不是也都为false？即forceUpdate和rerender调用时，避免了执行mounts.unshift(component)方法。

第一次的时候mountAll为什么也为false？ mountAll应该是强制让一个组件完全重新渲染

### renderComponent 的大致流程

是否是更新的组件

- 是，调用该调用的生命周期钩子
- 是否需要重新渲染，
  - 需要重新渲染
    - 子组件是不是组件，是的话；渲染子组件
    - 不是的话，diff处理

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
    - 如果是子也是一个组件的话就直接renderComponent了
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

第一步，遍历新的对象上；有没有和老的对象相同的属性，有的话看值有没有改变，有改变的话，就改掉，没有的话就添加，最后把剩下的没用的属性都删除

## 回收相关的方法

recollectNodeTree


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



###待做

- this.props为undefined，要学习它的renderComponent方法
- 卸载的几个方法
- 渲染第一层组件或节点后，第二层组件或节点时怎么渲染的？
- ['__preactattr_']与每等级组件的props是什么关系?