import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import socket from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Chat.css";

const ChatDrawer = ({ isOpen, onClose }) => {
  const { token, user } = useAuth();
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState("conversations");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await API.get("/chat/conversations", authHeaders);
      setConversations(res.data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  }, [token, authHeaders]);

  const fetchMessages = useCallback(async (otherUserId) => {
    if (!token || !otherUserId) return;
    setLoading(true);
    try {
      const res = await API.get(`/chat/messages/${otherUserId}`, authHeaders);
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  const fetchUsers = useCallback(async (search) => {
    if (!token) return;
    setUsersLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await API.get(`/chat/users${params}`, authHeaders);
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => {
    if (isOpen) {
      setView("conversations");
      setActiveConv(null);
      setMessages([]);
      fetchConversations();
    }
  }, [isOpen, fetchConversations]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.user._id);
    }
  }, [activeConv, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (view === "users") {
      fetchUsers(userSearch);
    }
  }, [view, userSearch, fetchUsers]);

  useEffect(() => {
    if (!isOpen || !token) return;

    const handleNewMessage = (msg) => {
      const isRelevant =
        msg.senderEmail === user?.email || msg.recipientEmail === user?.email;
      if (!isRelevant) return;

      fetchConversations();

      if (activeConv && (msg.senderEmail === activeConv.user.email || msg.recipientEmail === activeConv.user.email)) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [isOpen, token, user, activeConv, fetchConversations]);

  const handleSend = async () => {
    if (!messageText.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const res = await API.post("/chat/messages", {
        recipientEmail: activeConv.user.email,
        text: messageText.trim(),
      }, authHeaders);
      setMessages((prev) => [...prev, res.data]);
      setMessageText("");
      fetchConversations();
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const startConversation = (conv) => {
    setActiveConv(conv);
    setView("conversations");
  };

  const totalUnread = useMemo(() =>
    conversations.reduce((sum, c) => sum + (c.unread || 0), 0),
    [conversations]
  );

  const convUser = activeConv?.user;

  const sortedUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const term = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  if (!isOpen) return null;

  return (
    <>
      <div className="chat-overlay" onClick={onClose} />
      <div className="chat-drawer open">
        <div className="chat-header">
          <h3>Chat {totalUnread > 0 && <span className="chat-unread">{totalUnread}</span>}</h3>
          <button onClick={onClose} aria-label="Close chat">✕</button>
        </div>

        <div className="chat-body">
          {activeConv && convUser && view !== "users" ? (
            <>
              <div className="chat-conv-header">
                <button className="chat-back-btn" onClick={() => { setActiveConv(null); setMessages([]); }} aria-label="Back">
                  ←
                </button>
                <span>{convUser.name || convUser.email}</span>
                <span className="chat-conv-role" style={{ marginLeft: "auto" }}>{convUser.role || ""}</span>
              </div>
              <div className="chat-messages">
                {loading ? (
                  <div className="chat-empty">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">No messages yet. Say hello!</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg._id} className={`chat-bubble ${msg.senderEmail === user?.email ? "sent" : "received"}`}>
                      {msg.text}
                      <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-area">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={sending || loading}
                />
                <button onClick={handleSend} disabled={!messageText.trim() || sending || loading}>
                  {sending ? "..." : "Send"}
                </button>
              </div>
            </>
          ) : view === "users" ? (
            <>
              <div className="chat-conv-header">
                <button className="chat-back-btn" onClick={() => { setView("conversations"); setActiveConv(null); setMessages([]); }} aria-label="Back">
                  ←
                </button>
                <span>New Chat</span>
              </div>
              <div style={{ padding: "8px 12px" }}>
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div className="chat-conversations">
                {usersLoading ? (
                  <div className="chat-empty" style={{ padding: "40px 16px" }}>Loading users...</div>
                ) : sortedUsers.length === 0 ? (
                  <div className="chat-empty" style={{ padding: "40px 16px" }}>No users found.</div>
                ) : (
                  sortedUsers.map((u) => (
                    <div
                      key={u._id}
                      className="chat-conversation"
                      onClick={() => startConversation({ user: u })}
                    >
                      <div className="chat-avatar">
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="chat-conv-info">
                        <div className="chat-conv-name">
                          {u.name || u.email}
                          <span className="chat-conv-role">{u.role || ""}</span>
                        </div>
                        <div className="chat-conv-last">{u.email}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="chat-conversations">
              {conversations.length === 0 ? (
                <div className="chat-empty" style={{ padding: "40px 16px" }}>
                  <p style={{ margin: "0 0 12px", color: "#64748b" }}>No conversations yet.</p>
                  <button className="chat-toggle-btn" onClick={() => setView("users")}>
                    New Chat
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
                    <button className="chat-toggle-btn" onClick={() => { setView("users"); setUserSearch(""); }} style={{ width: "100%", justifyContent: "center" }}>
                      + New Chat
                    </button>
                  </div>
                  {conversations.map((conv, idx) => (
                    <div
                      key={conv.user.email || idx}
                      className="chat-conversation"
                      onClick={() => setActiveConv(conv)}
                    >
                      <div className="chat-avatar">
                        {(conv.user.name || conv.user.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="chat-conv-info">
                        <div className="chat-conv-name">
                          {conv.user.name || conv.user.email}
                          <span className="chat-conv-role">{conv.user.role || ""}</span>
                          {conv.unread > 0 && <span className="chat-unread">{conv.unread}</span>}
                        </div>
                        <div className="chat-conv-last">{conv.lastMessage || ""}</div>
                      </div>
                      <div className="chat-conv-time">{formatTime(conv.lastTime)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ChatDrawer;
