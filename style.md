## React fiber ##

react fiber的最大特点是增强渲染，将渲染工作分成多个块，并将其分散到多个帧。

其他关键性的能力有：当新更新进入时，暂停，中止，或重新开始。为不同类型的更新分配优先级，及new concurrency primitives。

动机关键点：

- 用户每次交互触发更新是没有必要的
- 不同的任务更新有不同的权限
- 基于push的方式去计划work，基于pull的方式允许变得更聪明，帮你做那些决定。


fiber需要做的：

- 暂停工作，在之后可以恢复
- 为不同类型的任务分配权限
- 重用先前未完成的工作
- 弃用工作，如果不再需要

一个fiber描述了一单元的工作


fiber是调用栈的重新实现

## react事件系统 ##

react中所有的事件是挂载的document上的，这样做的好处有：

- 处理了ie的兼容性问题
- 绑定事件是相当的慢和消耗内存的

每个react组件都有一个id，通过子id能找到父id，通过存储事件在一个hashmap上与id相对应

对于事件对象，每次创建对象意味着大量的内存分配，react在初始的时候会分配一个对象池，无论什么时候当你需要的时候，会从对象池中复用。这可以显著减少垃圾回收。

总结做了三件事：

- 如何绑定事件
- 如何触发事件
- 如何处理事件对象


## preact diffchildren ##

- 遍历dom原本的childNodes,构造出一个map keyed，构造出一个children
- 遍历vchildren,通过key或者相同类型，拿到child（真实dom）
- 将这个child与vchild做一个diff,拿到修改后的dom节点
- 然后判断执行三种可能的操作，dom.appendChild,removeNode,dom.insertBefore
- 然后将keyedLen中和children中多余的删除掉


## react中的diff ##

key是一个新旧节点的标识，lastIndex表示访问过的节点在老集合中最右的位置（即最大位置），遍历虚拟dom节点，找到老的dom树对应的节点，比较该dom节点的mountIndex与当前lastIndex，if(mountIndex > lastIndex)，即此时不动该节点不会影响其他节点，所以不做任何操作，否则移动该dom节点。