let socket = null;
let matchedSocketId = null;

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

let localStream = null;
let peerConnection = null;

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ],
};

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const startCallButton = document.getElementById("start-call");
const endCallButton = document.getElementById("end-call");

startCallButton.addEventListener("click", async () => {
  if (matchedSocketId) {
    socket.emit("start-call", matchedSocketId);
  } else {
    alert("You must be matched before starting a call.");
  }
});

endCallButton.addEventListener("click", () => {
  endVideoCall();
  socket.emit("end-call", matchedSocketId);
});

// === Handle WebRTC Signaling ===
socket.on("start-video", async (partnerId) => {
  matchedSocketId = partnerId;
  await startLocalStream();
  createPeerConnection();

  // Add tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("video-offer", offer, matchedSocketId);
});

socket.on("video-offer", async (offer, partnerId) => {
  matchedSocketId = partnerId;
  await startLocalStream();
  createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("video-answer", answer, matchedSocketId);
});

socket.on("video-answer", async (answer) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on("ice-candidate", async (candidate) => {
  if (peerConnection && candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding received ICE candidate", err);
    }
  }
});

socket.on("end-video", () => {
  endVideoCall();
  alert("The other user ended the call.");
});

async function startLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Failed to access camera:", err);
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate, matchedSocketId);
    }
  };

  peerConnection.ontrack = (event) => {
    console.log("Received remote stream");
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



