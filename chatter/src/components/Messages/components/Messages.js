import React, { useContext, useState, useEffect, useCallback, useRef } from 'react'
import io from 'socket.io-client'
import useSound from 'use-sound'
import { v4 as uuidv4 } from 'uuid'
import config from '../../../config'
import LatestMessagesContext from '../../../contexts/LatestMessages/LatestMessages'
import TypingMessage from './TypingMessage'
import Header from './Header'
import Footer from './Footer'
import Message from './Message'
import INITBOTMSG from '../../../common/constants/initialBottyMessage'
import sendSfx from '../../../assets/send.mp3'
import recieveSfx from '../../../assets/receive.mp3'
import '../styles/_messages.scss'

/*
    SOLUTION FOR CHATTER CODING CHALLENGE

    Author: EypoRage (Tobias K.)

    Disclaimer: usually i would not write that comment block to reduce verbosity of code but since this is a coding challenge which
                gets reviewed I thought this would be a good idea

    What i did :
    - implemented useEffect, useCallBack and React.memo() to optimize performance and amount of rerenders
      and to handle all events

    - show inital botty message by adding it to the messages list on component mount

    - handle onChangeMessage event to fetch the input value and to toggle the send button

    - scrolling to the bottom of the message list whenever the messagelist changes or the bot is typing
      by scolling to an div at the end of the list

    - playing send, recieve sound upon messagelist expansion. Soundfile is based on whether the user or the bot owns the message
      I had to add the soundfiles to the repo rather than fetching it from an url, because of CORS

    - handle sendMessage event by building an messageObject and adding it to a message list which gets rendered onto the page
      as well as emitting the user-message event to botty via socket.io. And I reset the input fields value after send.

    - listenting to message and typing botty events via socket.io, process the payload and expand the messageList with the
      botty message, or displaying the typing message

    - updating the latest message in the left side contact list

*/

// open connection to botty via socket.io, i purposely omitted checking the integrity of the connection (not the scope of this challenge)
const socket = io(
  config.BOT_SERVER_ENDPOINT,
  { transports: ['websocket', 'polling', 'flashsocket'] }
  )

function Messages() {

  // ### define vars and consts ###

  const BOT = "bot"
  const ME = "me"
  const [playSend] = useSound(sendSfx)
  const [playReceive] = useSound(recieveSfx)
  const { setLatestMessage } = useContext(LatestMessagesContext)
  const [message, isMessage] = useState(false)
  const [input, setInput] = useState("")
  const [messageList, setMessageList] = useState([])
  const [botTyping, isBotTyping] = useState(false)
  const messagesEndRef = useRef(null)


  // ### methods ###

  // for persistency i would opt in for redis or firebase to store messages with uids
  const buildMessage = (user, message) =>{
    let messageObject = {
      id:uuidv4(), 
      user:user,
      message:message,
    }

    setMessageList(messageList => [...messageList, messageObject])

    //this is considered unstable in chrome since its autoplay policy changed https://developer.chrome.com/blog/autoplay/
    if(user===BOT){
      playReceive()
    }else if(user===ME){
      playSend()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
  }


  // ### hooks ###

  /*  event listeners for botty socket connection 
      we want those socket.io listeners inside useEffect because react does funny things with recreating functions on component rerender
      we just want one listener per event
  */

  useEffect(() =>{
    socket.on('bot-message', (message) => {
      //console.log("MSG: " + message)
      isBotTyping(false)
      buildMessage(BOT,message)
      setLatestMessage(BOT,message)
    })
  },[])

  useEffect(() =>{
    socket.on('bot-typing', () => {
      //console.log("typ: "+ message)
      isBotTyping(true)
    })
  },[])

  useEffect(() =>{
    socket.on("connect", () => {
      //console.log(socket.id)
    })
  },[])


  // ### other hooks ###

  /*  we use useCallback to limit rerenders of child components that is passing props we handle here
      this is purely performance optimization
      additionally all child components using React.memo to only rerender when their props actually change
  */
 
  // handler for getting the input fields value
  const onChangeMessage = useCallback(event =>{
    setInput(event.target.value)
  },[input]) 

  // handler for the send button
  const sendMessage = useCallback(() => {
    buildMessage(ME,input)
    socket.emit('user-message',input)
  },[input, socket]) 

  // toggle send button
  useEffect(() => {
    input !== "" ? isMessage(true) :isMessage(false)
  }, [input])

  // display initial bot message and play sound on component mount
  useEffect(() => {
    buildMessage(BOT, INITBOTMSG)
  }, [])

  // scroll to bottom of messages
  useEffect(scrollToBottom, [messageList,botTyping])

  // reset input fields value
  useEffect(()=>{
    let lastMessage = messageList[messageList.length -1]
     if (lastMessage && lastMessage.user === ME){
        document.getElementById("user-message-input").value = ""
        setInput("")
     } 
  },[messageList])


  // ### Template ###
  
  return (
    <div className="messages">
      <Header />
      <div className="messages__list" id="message-list">
        {messageList.map((messageObj, index) =>{
          return <Message key={messageObj.id} nextMessage={messageList[index+1]} message={messageObj} botTyping={messageObj.user ===BOT?true:false}></Message>
        })}
          {botTyping?<TypingMessage></TypingMessage>:null}
         <div ref={messagesEndRef} />
      </div>
      <Footer message={message} sendMessage={sendMessage} onChangeMessage={onChangeMessage} />
    </div>
  )
}

export default Messages
