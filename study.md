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
  - 需要重新渲染, 

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