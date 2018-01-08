/* eslint-disable */
import './style';
// import App from './components/app';
// import { render, Component, h } from 'preact'
import { setTimeout } from 'timers';
import { render, h, Component } from './MyPreact'
// import { setTimeout } from 'timers';

// class MyApp extends Component{
//   state = {
//     number1: '11111',
//     number2: '22222'
//   }

//   componentDidMount(){
//     this.handler = setTimeout(() => {
//       console.log('will diff')
//       this.setState({
//         number1: ''
//       })
//       this.setState({
//         number2: 'diff2'
//       })
//     }, 2000)
//   }

//   componentWillUnmount(){
//     clearTimeout(this.handler)
//   }

//   render(){
//     const { title } = this.props
//     const { number1, number2 } = this.state
//     return (
//       h("div", {
//         id: "foo",
//       }, [
//         number1 && h("div", {id: "bar"}, [
//           h("span", {}, number1),
//           h("span", {}, number2)
//         ]),
//         h("span", {}, title)
//       ])
//       // <div id="foo">
//       //   <div id="bar">
//       //   {
//       //     number1 && <span>{number1}</span>
//       //   }
//       //     <span>{number2}</span>
//       //   </div>
//       //   <span>{title}</span>
//       // </div>
//     )
//   }
// }

class MyChild extends Component{
  render(){
    let  props = { ...this.props }
    delete props.children
    return (
      <div id='myspan' {...props}>
        {this.props.children}
      </div>
    )
  }
}

class MySpan extends Component{
  render(){
    return <MyChild {...this.props} />
  }
}

class MyApp extends Component{
  state = {
    number: '143243'
  }

  componentDidMount(){
    setTimeout( () => {
      this.setState({
        number: '200434'
      }, () => {
        console.log('number', this.state.number)
      })
    }, 2000)
  }

  render(){
    console.log('this', this.props)
    debugger
    const { title } = this.props
    const { number } = this.state
    // if(number > 20){
    //   return (
    //     <MySpan id='child' style={{color: 'red', fontSize: 40}}>{number}</MySpan>
    //   )
    // } else {
    //   return (
    //     <span>{title}</span>
    //   )
    // }
    return (
      <MySpan>{number}</MySpan>
    )

  }
}

let title = '64544'

setTimeout(() => {
  title = '53453253'
}, 3000)

render((
  <MyApp title={title} />
), document.body)