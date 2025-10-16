/**
 * Cloud Functions for CollabCanvas AI Agent
 * Provides secure proxy for OpenAI API calls
 */

const functions = require("firebase-functions");
const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const OpenAI = require("openai");

// Cost control: limit concurrent instances
setGlobalOptions({maxInstances: 10});

// Lazy initialization of OpenAI client
let openaiClient = null;
const getOpenAI = () => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY ||
                   functions.config().openai?.key;
    openaiClient = new OpenAI({apiKey});
  }
  return openaiClient;
};

/**
 * Callable function for AI canvas commands
 * Authenticated users only
 * 
 * @param {Object} data - Request data
 * @param {string} data.message - User's command
 * @param {Object} data.canvasState - Current canvas state (shapes)
 * @param {string} data.systemPrompt - System instructions for AI
 * @param {Array} data.tools - OpenAI function calling tool definitions
 * @param {Object} context - Function call context with auth info
 */
exports.callAI = onCall({
  maxInstances: 5,
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  const {data, auth} = request;

  // Verify user is authenticated
  if (!auth) {
    throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to use AI assistant",
    );
  }

  const {message, canvasState, systemPrompt, tools} = data;

  // Validate required parameters
  if (!message || !systemPrompt || !tools) {
    throw new HttpsError(
        "invalid-argument",
        "Missing required parameters: message, systemPrompt, or tools",
    );
  }

  logger.info("AI request", {
    userId: auth.uid,
    messageLength: message.length,
    shapesCount: canvasState?.length || 0,
  });

  try {
    // Build messages array with canvas state context
    const messages = [
      {role: "system", content: systemPrompt},
    ];

    // Add canvas state as context if provided
    if (canvasState && canvasState.length > 0) {
      messages.push({
        role: "system",
        content: `Current canvas state (${canvasState.length} shapes):\n` +
          JSON.stringify(canvasState, null, 2),
      });
    }

    messages.push({role: "user", content: message});

    // Call OpenAI API with function calling
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cost-effective
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.7,
    });

    const aiMessage = response.choices[0].message;

    logger.info("AI response", {
      userId: auth.uid,
      hasToolCalls: !!aiMessage.tool_calls,
      toolCallsCount: aiMessage.tool_calls?.length || 0,
      toolCalls: aiMessage.tool_calls?.map((tc) => ({
        name: tc.function.name,
        args: tc.function.arguments,
      })),
    });

    // Return the AI's response
    return {
      success: true,
      message: aiMessage,
      usage: response.usage, // Token usage for monitoring
    };
  } catch (error) {
    logger.error("OpenAI API Error", {
      userId: auth.uid,
      error: error.message,
      code: error.code,
    });

    // Handle specific OpenAI errors
    if (error.code === "insufficient_quota") {
      throw new HttpsError(
          "resource-exhausted",
          "AI service quota exceeded. Please try again later.",
      );
    }

    if (error.code === "rate_limit_exceeded") {
      throw new HttpsError(
          "resource-exhausted",
          "Too many requests. Please wait a moment and try again.",
      );
    }

    // Generic error
    throw new HttpsError(
        "internal",
        "Failed to process AI request. Please try again.",
    );
  }
});
