import { httpsCallable } from 'firebase/functions';
import { functions, db } from './firebase';
import { createShape, updateShape, deleteShape } from './canvasService';
import { doc, writeBatch } from 'firebase/firestore';

const CANVAS_ID = 'main-canvas';

// Initialize callable function
const callAIFunction = httpsCallable(functions, 'callAI');

// System prompt that teaches the AI how to work with the canvas
const SYSTEM_PROMPT = `You are an AI assistant that helps users create and manipulate shapes on a collaborative canvas.

Canvas Details:
- Canvas size: 5000x5000 pixels
- Available shapes: rectangle, ellipse, text
- Coordinate system: (0, 0) is top-left, (5000, 5000) is bottom-right
- Center of canvas is at (2500, 2500)
- Colors: Use hex codes (e.g., "#FF0000") or common color names that will be converted

Your capabilities:
1. Create shapes with specific positions, sizes, and colors using createShape
2. Update existing shapes (move, resize, recolor, rotate) using updateShape
3. Get current canvas state to reference existing shapes using getCanvasState
4. Create multiple shapes for complex layouts using createMultipleShapes ⭐
5. Delete shapes using deleteShape

CRITICAL PERFORMANCE RULE:
⚡ For 3+ shapes in ONE command, ALWAYS use createMultipleShapes (not multiple createShape calls)
⚡ This applies to: grids, patterns, forms, layouts, UI components, repeated elements
⚡ Examples requiring createMultipleShapes:
  • "Create a 5x5 grid of squares" → ONE createMultipleShapes call with 25 shapes
  • "Make a login form" → ONE createMultipleShapes call with all form elements  
  • "Add 10 circles in a row" → ONE createMultipleShapes call with 10 circles
  • "Create a navbar with 5 buttons" → ONE createMultipleShapes call
⚡ Only use individual createShape for truly isolated, single shapes

Guidelines:
- Use reasonable default sizes if not specified: 150x100 for rectangles, 100x100 for ellipses, 200x50 for text
- For text shapes, always include the text content in the text parameter (e.g., text: "Welcome")
- Use font size 24-32 for normal text, 40-60 for headlines
- When arranging multiple shapes, space them appropriately (50-100px apart)
- For complex commands like "create a login form", use text shapes for labels with appropriate shapes
- Always call getCanvasState first if the command references existing shapes (e.g., "move the blue rectangle")
- When multiple shapes match a description (e.g., multiple blue rectangles), operate on the first one and mention this in your response
- For colors, convert common names to hex codes: red=#FF0000, blue=#0000FF, green=#00FF00, yellow=#FFFF00, orange=#FFA500, purple=#800080, pink=#FFC0CB, white=#FFFFFF, black=#000000, gray=#808080
- When creating UI components (forms, buttons, labels), use text shapes for readability
- Text should be readable - use dark colors (#000000, #333333) for text on light backgrounds

Be concise and clear in your responses. Execute the requested actions and confirm what you did.`;

// Tool definitions for OpenAI function calling
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'createShape',
      description: 'Create a new shape on the canvas',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['rectangle', 'ellipse', 'text'],
            description: 'Type of shape to create'
          },
          x: {
            type: 'number',
            description: 'X coordinate (0-5000, center is 2500)'
          },
          y: {
            type: 'number',
            description: 'Y coordinate (0-5000, center is 2500)'
          },
          width: {
            type: 'number',
            description: 'Width in pixels'
          },
          height: {
            type: 'number',
            description: 'Height in pixels'
          },
          fill: {
            type: 'string',
            description: 'Fill color (hex code like #FF0000)'
          },
          rotation: {
            type: 'number',
            description: 'Rotation in degrees (optional, default 0)'
          },
          text: {
            type: 'string',
            description: 'Text content (required for text type)'
          },
          fontSize: {
            type: 'number',
            description: 'Font size in pixels (optional, default 24, for text type)'
          }
        },
        required: ['type', 'x', 'y', 'width', 'height', 'fill']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateShape',
      description: 'Update an existing shape\'s properties. Call getCanvasState first to find the shape ID.',
      parameters: {
        type: 'object',
        properties: {
          shapeId: {
            type: 'string',
            description: 'ID of the shape to update (get this from getCanvasState)'
          },
          x: {
            type: 'number',
            description: 'New X coordinate (optional)'
          },
          y: {
            type: 'number',
            description: 'New Y coordinate (optional)'
          },
          width: {
            type: 'number',
            description: 'New width (optional)'
          },
          height: {
            type: 'number',
            description: 'New height (optional)'
          },
          fill: {
            type: 'string',
            description: 'New fill color (optional)'
          },
          rotation: {
            type: 'number',
            description: 'New rotation in degrees (optional)'
          }
        },
        required: ['shapeId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteShape',
      description: 'Delete a shape from the canvas. Call getCanvasState first to find the shape ID.',
      parameters: {
        type: 'object',
        properties: {
          shapeId: {
            type: 'string',
            description: 'ID of the shape to delete (get this from getCanvasState)'
          }
        },
        required: ['shapeId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCanvasState',
      description: 'Get current canvas state (all shapes). Use this before manipulating or referencing existing shapes.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createMultipleShapes',
      description: 'Create multiple shapes at once in a single optimized operation. REQUIRED for 3+ shapes in one command. Use for: grids, patterns, forms, navbars, UI layouts, repeated elements.',
      parameters: {
        type: 'object',
        properties: {
          shapes: {
            type: 'array',
            description: 'Array of shape definitions',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['rectangle', 'ellipse', 'text']
                },
                x: {
                  type: 'number'
                },
                y: {
                  type: 'number'
                },
                width: {
                  type: 'number'
                },
                height: {
                  type: 'number'
                },
                fill: {
                  type: 'string'
                },
                rotation: {
                  type: 'number'
                },
                text: {
                  type: 'string',
                  description: 'Text content (required for text type shapes)'
                },
                fontSize: {
                  type: 'number',
                  description: 'Font size in pixels (optional for text type, default 24)'
                }
              },
              required: ['type', 'x', 'y', 'width', 'height', 'fill']
            }
          }
        },
        required: ['shapes']
      }
    }
  }
];

/**
 * Generate a unique shape ID
 */
const generateShapeId = () => {
  return `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Execute a tool call from the AI
 * @param {Object} toolCall - OpenAI tool call object
 * @param {string} userId - User ID executing the command
 * @param {Array} currentShapes - Current canvas shapes for getCanvasState
 * @returns {Promise<Object>} Result of the tool execution
 */
const executeTool = async (toolCall, userId, currentShapes) => {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);

  try {
    switch (functionName) {
      case 'createShape': {
        const shapeId = generateShapeId();
        const shapeData = {
          id: shapeId,
          type: args.type,
          x: args.x,
          y: args.y,
          width: args.width,
          height: args.height,
          fill: args.fill,
          rotation: args.rotation || 0,
          ...(args.type === 'text' && {
            text: args.text || 'Text',
            fontSize: args.fontSize || 24,
            fontFamily: 'Arial'
          })
        };
        await createShape(userId, shapeData);
        return {
          success: true,
          message: `Created ${args.type} at (${args.x}, ${args.y})`,
          data: shapeData
        };
      }

      case 'updateShape': {
        console.log('[AI] updateShape called with args:', args);
        
        const updates = {};
        if (args.x !== undefined) updates.x = args.x;
        if (args.y !== undefined) updates.y = args.y;
        if (args.width !== undefined) updates.width = args.width;
        if (args.height !== undefined) updates.height = args.height;
        if (args.fill !== undefined) updates.fill = args.fill;
        if (args.rotation !== undefined) updates.rotation = args.rotation;
        
        console.log('[AI] updateShape updates:', updates);
        
        if (Object.keys(updates).length === 0) {
          console.warn('[AI] updateShape called but no updates provided!');
          return {
            success: false,
            message: `No updates specified for shape ${args.shapeId}`
          };
        }
        
        await updateShape(userId, args.shapeId, updates);
        return {
          success: true,
          message: `Updated shape ${args.shapeId} with ${Object.keys(updates).join(', ')}`,
          data: updates
        };
      }

      case 'deleteShape': {
        await deleteShape(args.shapeId);
        return {
          success: true,
          message: `Deleted shape ${args.shapeId}`
        };
      }

      case 'getCanvasState': {
        // Return optimized canvas state - only essential data
        const optimizedShapes = optimizeCanvasState(currentShapes);
        return {
          success: true,
          message: `Retrieved ${currentShapes.length} shapes`,
          data: optimizedShapes
        };
      }

      case 'createMultipleShapes': {
        // Use batch writes for atomic, faster multi-shape creation
        const batch = writeBatch(db);
        const createdShapes = [];
        
        for (const shape of args.shapes) {
          const shapeId = generateShapeId();
          const shapeData = {
            id: shapeId,
            type: shape.type,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            fill: shape.fill,
            rotation: shape.rotation || 0,
            updatedBy: userId,
            updatedAt: Date.now(),
            ...(shape.type === 'text' && {
              text: shape.text || 'Text',
              fontSize: shape.fontSize || 24,
              fontFamily: 'Arial'
            })
          };
          
          // Add to batch instead of individual write
          const shapeRef = doc(db, 'canvases', CANVAS_ID, 'objects', shapeId);
          batch.set(shapeRef, shapeData);
          
          createdShapes.push(shapeData);
        }
        
        // Commit all writes in single transaction
        await batch.commit();
        
        return {
          success: true,
          message: `Created ${createdShapes.length} shapes`,
          data: createdShapes
        };
      }

      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    console.error(`Error executing ${functionName}:`, error);
    return {
      success: false,
      message: `Failed to execute ${functionName}: ${error.message}`
    };
  }
};

/**
 * Determine if the command needs canvas state context
 * @param {string} message - User's command
 * @returns {boolean} Whether canvas state is needed
 */
const needsCanvasState = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Commands that reference existing shapes
  const referenceKeywords = [
    'move', 'delete', 'update', 'change', 'modify', 'resize', 'rotate',
    'the ', 'that ', 'this ', 'those ', 'these ',
    'all ', 'every ', 'each ',
    'blue', 'red', 'green', 'yellow', 'orange', 'purple', 'pink', // color references
    'rectangle', 'circle', 'ellipse', 'text', 'shape' // shape type references
  ];
  
  return referenceKeywords.some(keyword => lowerMessage.includes(keyword));
};

/**
 * Filter and optimize canvas state for AI context
 * Only send essential shape data to reduce payload size and token usage
 * @param {Array} shapes - All canvas shapes
 * @returns {Array} Filtered shape data
 */
const optimizeCanvasState = (shapes) => {
  if (!shapes || shapes.length === 0) return [];
  
  // Send only essential data - omit detailed properties
  return shapes.map(shape => ({
    id: shape.id,
    type: shape.type,
    x: Math.round(shape.x),
    y: Math.round(shape.y),
    fill: shape.fill,
    ...(shape.type === 'text' && shape.text && { text: shape.text.substring(0, 50) }) // Truncate long text
  }));
};

/**
 * Send a command to the AI and execute the resulting actions
 * @param {string} message - User's natural language command
 * @param {string} userId - User ID
 * @param {Array} currentShapes - Current canvas shapes
 * @returns {Promise<Object>} Result containing AI response and execution results
 */
export const sendCommand = async (message, userId, currentShapes = []) => {
  try {
    // Optimize payload: only send canvas state if command references existing shapes
    const shouldSendCanvasState = needsCanvasState(message);
    const optimizedCanvasState = shouldSendCanvasState 
      ? optimizeCanvasState(currentShapes)
      : [];
    
    if (shouldSendCanvasState) {
      console.log(`[AI] Sending ${optimizedCanvasState.length} shapes as context`);
    } else {
      console.log('[AI] Command does not need canvas state - optimizing payload');
    }
    
    // Call the Cloud Function with the user's message
    const result = await callAIFunction({
      message,
      canvasState: optimizedCanvasState,
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS
    });

    const { message: aiMessage, usage } = result.data;

    // If the AI returned tool calls, execute them in parallel for maximum performance
    let toolResults = [];
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      console.log(`[AI] Executing ${aiMessage.tool_calls.length} tool calls in parallel`);
      
      // Execute all tool calls in parallel using Promise.all
      // This dramatically improves performance for multi-shape operations
      toolResults = await Promise.all(
        aiMessage.tool_calls.map(async (toolCall) => {
          const result = await executeTool(toolCall, userId, currentShapes);
          return {
            toolCall: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            result
          };
        })
      );
      
      console.log(`[AI] Completed ${toolResults.length} tool calls`);
    }

    return {
      success: true,
      aiResponse: aiMessage.content || 'Done!',
      toolCalls: toolResults,
      usage
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'unauthenticated') {
      return {
        success: false,
        error: 'You must be logged in to use the AI assistant'
      };
    }
    
    if (error.code === 'resource-exhausted') {
      return {
        success: false,
        error: 'AI service is temporarily unavailable. Please try again in a moment.'
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to process AI command. Please try again.'
    };
  }
};

export default {
  sendCommand
};

