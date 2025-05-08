let socket = null;
let matchedSocketId = null;
let localStream=null;
let peerConnection=null;
// First, ping the backend to wake it up (Render cold-start workaround)
    // Initialize socket connection after backend is ready
    socket = io("https://backend-nskg.onrender.com");

    // DOM Elements
    const genderSelect = document.getElementById('gender');
    const interestInput = document.getElementById('interest');
    const findMatchButton = document.getElementById('find-match');
    const messageInput = document.getElementById('message');
    const sendMessageButton = document.getElementById('send-message');
    const messagesTextarea = document.getElementById('messages');
    const disconnectButton = document.getElementById('disconnect'); 
    const interestButtons = document.querySelectorAll('#interest-buttons button');
    const startCallButton = document.getElementById("start-call");
    const endCallButton = document.getElementById("end-call");

    startCallButton.addEventListener("click", () => {
      if (matchedSocketId) {
        socket.emit("start-call", matchedSocketId);
      } else {
        alert("You need to be matched with someone first.");
      }
    });
    
    endCallButton.addEventListener("click", () => {
      endVideoCall();
      socket.emit("end-call", matchedSocketId);
    });
    interestButtons.forEach(button => {
      button.addEventListener('click', () => {
        const selectedInterest = button.getAttribute('data-interest');
        interestInput.value = selectedInterest;
      });
    });

    findMatchButton.addEventListener('click', () => {
     
        const preferences = {
          gender: genderSelect.value,
          interest: interestInput.value
        };

        socket.emit('user-details', preferences); 
        messagesTextarea.value = "🔍 Searching for a match...";
      }
    );
    socket.on('disconect',message =>{  
      if(matchedSocketId==null){ 
        messagesTextarea.value += `\n you are not connected`; 
        
      } 
      else{
      matchedSocketId=null; 
      messagesTextarea.value += `\n${message}`;
      }
  
     });
    socket.on('match-found', data => {
      if (data.matched) {
        messagesTextarea.value = "✅ Match found! Start chatting!";
        matchedSocketId = data.socketId;
        console.log("Matched with:", matchedSocketId);
      }
    });

    socket.on('receive-message', message => { 
      messagesTextarea.value += `\n partner: ${message}`;
    });

    sendMessageButton.addEventListener('click', () => {
      const message = messageInput.value.trim();

      if (message && matchedSocketId) {
        messagesTextarea.value += `\nYou: ${message}`;
        socket.emit('send-message', message, matchedSocketId);
        messageInput.value = '';
      } else {
        messagesTextarea.value += "\n⚠️ No match to send message.";
      }
    });

    disconnectButton.addEventListener('click', () => {
      if (matchedSocketId) {
        socket.emit('disconnect-chat', matchedSocketId);
        messagesTextarea.value = "🔌 Disconnected.";
      } else {
        messagesTextarea.value += "\n⚠️ Not connected to anyone.";
      }
    }); 
// --- WebRTC & Video Handling --

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // Public STUN
    // TURN example (you can replace with your own credentials)
    // {
    //   urls: 'turn:your.turn.server:3478',
    //   username: 'user',
    //   credential: 'pass'
    // }
  ],
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

socket.on("start-video", async (partnerId) => {
  matchedSocketId = partnerId;
  await startLocalStream();
  createPeerConnection();

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("video-offer", offer, partnerId);
});

socket.on("video-offer", async (offer, partnerId) => {
  matchedSocketId = partnerId;
  await startLocalStream();
  createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("video-answer", answer, partnerId);
});

socket.on("video-answer", async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", async (candidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}); 
socket.on("end-video", () => {
  endVideoCall();
  alert("The other user ended the video call.");
});

async function startLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate, matchedSocketId);
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
} 
function endVideoCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
}


