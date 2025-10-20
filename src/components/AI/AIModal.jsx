import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { sendCommand } from '../../services/aiService';
import './AIModal.css';

/**
 * AI Assistant Modal
 * Chat interface for natural language canvas commands
 */
const AIModal = ({ isOpen, onClose, currentShapes, onShapesCreated }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you create and manipulate shapes on the canvas. Try commands like:\n\n• "Create a blue rectangle at 500, 500"\n• "Add a red circle in the center"\n• "Move the blue shape to 1000, 1000"\n• "Create a login form"',
      timestamp: Date.now()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { user } = useAuth();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcut (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Send command to AI service
      const result = await sendCommand(userMessage, user.uid, currentShapes);

      if (result.success) {
        // OPTIMISTIC UPDATE: Add created shapes to Canvas immediately
        if (result.createdShapes && result.createdShapes.length > 0 && onShapesCreated) {
          onShapesCreated(result.createdShapes);
        }
        
        // Show progress for large operations
        const toolCallCount = result.toolCalls?.length || 0;
        const isLargeOperation = toolCallCount >= 10;
        
        // Format the response message
        let responseContent = result.aiResponse;
        
        // Add tool execution details if available
        if (result.toolCalls && result.toolCalls.length > 0) {
          // For large operations, show a summary instead of all details
          if (isLargeOperation) {
            const createCount = result.toolCalls.filter(tc => 
              tc.toolCall === 'createShape' || tc.toolCall === 'createMultipleShapes'
            ).length;
            
            if (createCount > 0) {
              responseContent = `✓ Created ${toolCallCount} shapes successfully!`;
            } else {
              responseContent = `✓ Completed ${toolCallCount} operations successfully!`;
            }
          } else {
            // For smaller operations, show details
            const executionSummary = result.toolCalls
              .map(tc => tc.result.message)
              .join('\n');
            
            if (!responseContent || responseContent === 'Done!') {
              responseContent = `✓ ${executionSummary}`;
            }
          }
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responseContent,
          timestamp: Date.now(),
          status: 'success'
        }]);
      } else {
        // Error from AI service
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✗ Error: ${result.error}`,
          timestamp: Date.now(),
          status: 'error'
        }]);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✗ Error: Failed to process command. Please try again.`,
        timestamp: Date.now(),
        status: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-modal-overlay">
      <div className="ai-modal">
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <span className="ai-modal-icon">✨</span>
            <span>AI Assistant</span>
          </div>
          <button
            className="ai-modal-close"
            onClick={onClose}
            aria-label="Close AI Assistant"
          >
            ×
          </button>
        </div>

        {/* Chat Messages */}
        <div className="ai-modal-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`ai-message ${message.role} ${message.status || ''}`}
            >
              <div className="ai-message-content">
                {message.content}
              </div>
              <div className="ai-message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="ai-message assistant loading">
              <div className="ai-message-content">
                <div className="ai-loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                AI is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form className="ai-modal-input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="ai-modal-input"
            placeholder="Type your command... (e.g., 'Create a blue circle')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="ai-modal-send"
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </form>

        {/* Quick Actions */}
        <div className="ai-modal-hints">
          <span className="ai-hint">💡 Tip: Press Escape to close</span>
        </div>
      </div>
    </div>
  );
};

export default AIModal;

