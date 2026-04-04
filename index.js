import { Server } from "socket.io";
const io = new Server(8000,{
    cors : true,
});

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  socket.on("room:join", (data) => {
    const { email, room } = data;
    
    // Check if the user is the first one in the room
    const existingUsers = io.sockets.adapter.rooms.get(room);
    const isAdmin = !existingUsers || existingUsers.size === 0;
    
    let remoteSocketId = null;
    let remoteEmail = null;

    // Notify the newcomer about the existing user
    if (existingUsers && existingUsers.size > 0) {
      remoteSocketId = Array.from(existingUsers)[0];
      remoteEmail = socketidToEmailMap.get(remoteSocketId);
      socket.emit("user:joined", { email: remoteEmail, id: remoteSocketId });
    }

    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    io.to(room).emit("user:joined", { email, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", { ...data, isAdmin, remoteSocketId, remoteEmail });
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

    socket.on("call:end", ({ to }) => {
      io.to(to).emit("call:ended", { from: socket.id });
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("user:left", { id: socket.id });
        }
      }
    });

    socket.on("disconnect", () => {
    const email = socketidToEmailMap.get(socket.id);
    if (email) {
      emailToSocketIdMap.delete(email);
      socketidToEmailMap.delete(socket.id);
    }
    console.log(`Socket Disconnected`, socket.id);
  });
});