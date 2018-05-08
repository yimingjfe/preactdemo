/* eslint-disable */
import './style';
// import App from './components/app';
import { render, Component, h } from '../preact.dev.js'
// import { render, h, Component } from './MyPreact'
// import { setTimeout } from 'timers';


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

// class MySpan extends Component{
//   render(){
//     return <MyChild {...this.props} />
//   }
// }

class MySpan extends Component{
  render(){
    return (
      <div>
        {this.props.children}
      </div> 
    )
  }
}

class MyApp extends Component{
  state = {
    number: '143243',
  }

  componentDidMount(){
    // setTimeout( () => {
    //   this.setState({
    //     number: '200434'
    //   }, () => {
    //     console.log('number', this.state.number)
    //   })
    // }, 2000)

    // setTimeout( () => {
    //   this.forceUpdate()
    // }, 3000);

    setTimeout(() => {
      this.setState({
        number: '12412423'
      })
    }, 4000)
  }

  // _renderMySpan = () => {
  //   const { flag } = this.state
  //   if(!flag){
  //     return <MySpan>5583</MySpan>
  //   } else {
  //     return <MySpan>53y6</MySpan>
  //   }
  // }

  render(){
    console.log('this', this.props)
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
        <MySpan>
          <div>{number}</div>
        </MySpan>
    )

  }
}

let title = '64544'

render((
  <MyApp title={title} />
), document.body)