import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Influencer, UserRole, User } from '../types';

// Assume process.env.API_KEY is available in the environment
if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMessageDraft = async (influencerName: string, niche: string): Promise<string> => {
  try {
    const ai = getAi();
    const prompt = `Generate a short, friendly, and professional outreach message to an influencer named ${influencerName}. Our brand is BIGYAPON, a platform connecting brands with influencers. Mention that we are impressed with their content in the ${niche} niche and would love to discuss a potential collaboration. Keep it concise and engaging.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating message draft:", error);
    return "Sorry, I couldn't generate a message right now. Please try again.";
  }
};

export const generateCollabProposal = async (influencerName: string, brandName: string, campaignIdea: string): Promise<string> => {
  try {
    const ai = getAi();
    const prompt = `Generate a friendly and professional collaboration proposal message from a brand named "${brandName}" to an influencer named ${influencerName}.
The initial idea for the campaign is: "${campaignIdea}".
The message should:
1. Express admiration for the influencer's content.
2. Clearly state the brand's interest in collaborating.
3. Briefly introduce the campaign idea.
4. Propose discussing details further.
5. Keep the tone enthusiastic and respectful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating collab proposal:", error);
    return "I'm having trouble drafting a proposal right now. Please try again or write your own.";
  }
};

export const generateDashboardTip = async (role: UserRole, name: string): Promise<string> => {
  try {
    const ai = getAi();
    const roleDescription = {
      brand: 'a brand manager looking for influencers',
      influencer: 'an influencer looking for brand collaborations',
      livetv: 'a Live TV channel manager looking for advertisers',
      banneragency: 'a banner advertising agency manager',
      staff: 'a platform administrator'
    };
    
    const prompt = `You are a helpful assistant for "BIGYAPON", an influencer marketing platform.
Generate a short, friendly, encouraging, and actionable 'pro tip' for a user.
The user's name is ${name} and they are ${roleDescription[role] || 'a user'}.
The tip should be about how to best use the platform or general industry advice relevant to their role.
Keep it to one or two sentences. Be creative. Do not use markdown.

Example for a brand: "Try using specific keywords like 'eco-friendly' in your AI search to find influencers who truly align with your brand's values!"
Example for an influencer: "Make sure your bio is updated with your latest achievements to attract bigger and better brand deals!"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating dashboard tip:", error);
    return "Could not generate a tip right now. Why not explore the influencer listings?";
  }
};

// FIX: Added missing 'findInfluencersWithAI' function to be exported.
export const findInfluencersWithAI = async (query: string, influencers: Influencer[]): Promise<string[]> => {
  if (!query.trim()) {
    return influencers.map(i => i.id);
  }

  try {
    const ai = getAi();
    const prompt = `
      You are an advanced search algorithm for an influencer discovery platform.
      Analyze the user's search query and the provided JSON list of influencers.
      Return only the IDs of the influencers that match the criteria in the query.
      The query might be about niche, follower count (e.g., "over 100k", "less than 50k"), location, keywords in their bio, or engagement rate.

      User Query: "${query}"

      Influencer List (JSON):
      ${JSON.stringify(influencers.map(inf => ({
          id: inf.id,
          name: inf.name,
          handle: inf.handle,
          bio: inf.bio,
          followers: inf.followers,
          niche: inf.niche,
          engagementRate: inf.engagementRate,
          location: inf.location
      })), null, 2)}

      Respond with a JSON object that strictly adheres to this schema: { "matchingIds": ["string"] }.
      The "matchingIds" array should contain the string IDs of the matching influencers.
      If no influencers match, the "matchingIds" array should be empty.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText);

    if (result && Array.isArray(result.matchingIds)) {
      return result.matchingIds;
    }

    return [];
  } catch (error) {
    console.error("Error filtering influencers with AI:", error);
    // On error, just return all IDs to not break the UI completely
    return influencers.map(i => i.id);
  }
};


export const filterPayoutsWithAI = async (query: string, items: any[]): Promise<string[]> => {
  if (!query.trim()) {
    return items.map(i => i.id);
  }

  try {
    const ai = getAi();
    const prompt = `
      You are an advanced filtering algorithm for a financial dashboard.
      Analyze the user's query and the provided JSON list of payout/refund requests.
      Your task is to return only the IDs of the items that match the criteria in the query.
      The query might be about amounts (e.g., "over 5000", "less than 100"), statuses (e.g., "pending", "rejected refunds"), user names, user PI numbers (Profile ID), collaboration titles, collaboration document IDs, or the user-facing Collab ID (e.g. CRI1234567890), or types (e.g., "all refunds", "daily payouts").

      User Query: "${query}"

      Request List (JSON):
      ${JSON.stringify(items.map(item => ({
          id: item.id,
          requestType: item.requestType,
          status: item.status,
          amount: item.amount,
          userName: item.userName,
          userPiNumber: item.userPiNumber,
          collabTitle: item.collabTitle,
          collaborationId: item.collaborationId,
          collabId: item.collabId,
          date: item.timestamp?.toDate ? item.timestamp.toDate().toISOString().split('T')[0] : null
      })), null, 2)}

      Respond with a JSON object that strictly adheres to this schema: { "matchingIds": ["string"] }.
      The "matchingIds" array should contain the string IDs of the matching items.
      If no items match the query, the "matchingIds" array should be empty.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText);

    if (result && Array.isArray(result.matchingIds)) {
      return result.matchingIds;
    }

    return [];
  } catch (error) {
    console.error("Error filtering payouts with AI:", error);
    // On error, just return all IDs to not break the UI completely
    return items.map(i => i.id);
  }
};

export const filterTransactionsWithAI = async (query: string, items: any[]): Promise<string[]> => {
  if (!query.trim()) {
    return items.map(i => i.transactionId);
  }

  try {
    const ai = getAi();
    const prompt = `
      You are an advanced filtering algorithm for a financial dashboard.
      Analyze the user's query and the provided JSON list of transactions.
      Your task is to return only the "transactionId" of the items that match the criteria in the query.
      The query might be about amounts, statuses, user names, user roles, user PI numbers (Profile ID), descriptions, collaboration document IDs, user-facing Collab IDs (e.g. CRI1234567890), or types (e.g., "all payments", "payouts").

      User Query: "${query}"

      Transaction List (JSON):
      ${JSON.stringify(items.map(item => ({
          transactionId: item.transactionId,
          type: item.type,
          status: item.status,
          amount: item.amount,
          userName: item.userName,
          userRole: item.userRole,
          userPiNumber: item.userPiNumber,
          description: item.description,
          collaborationId: item.collaborationId,
          collabId: item.collabId,
          date: item.date ? item.date.toISOString().split('T')[0] : null
      })), null, 2)}

      Respond with a JSON object that strictly adheres to this schema: { "matchingIds": ["string"] }.
      The "matchingIds" array should contain the string "transactionId" of the matching items.
      If no items match the query, the "matchingIds" array should be empty.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText);

    if (result && Array.isArray(result.matchingIds)) {
      return result.matchingIds;
    }

    return [];
  } catch (error) {
    console.error("Error filtering transactions with AI:", error);
    // On error, return all IDs to not break UI
    return items.map(i => i.transactionId);
  }
};


export const filterDisputesWithAI = async (query: string, disputes: any[], allUsers: User[]): Promise<string[]> => {
  if (!query.trim()) {
    return disputes.map(d => d.id);
  }

  try {
    const ai = getAi();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const prompt = `
      You are an advanced filtering assistant for a disputes resolution panel.
      Analyze the user's search query and the provided JSON list of disputes.
      Return only the IDs of the disputes that match the criteria in the query.
      The query might ask about specific names, user PI numbers (Profile ID), reasoning keywords (e.g., "incomplete work", "fraud", "unresponsive"), statuses (e.g., "open", "resolved"), collaboration document IDs, user-facing Collab IDs (e.g. CRI1234567890), or dates.

      User Query: "${query}"

      Dispute List (JSON):
      ${JSON.stringify(disputes.map(d => {
        const reporter = userMap.get(d.disputedById);
        const against = userMap.get(d.disputedAgainstId);
        return {
            id: d.id,
            reporter: d.disputedByName,
            reporterPiNumber: reporter?.piNumber,
            against: d.disputedAgainstName,
            againstPiNumber: against?.piNumber,
            reason: d.reason,
            collab: d.collaborationTitle,
            collaborationId: d.collaborationId,
            collabId: d.collabId,
            status: d.status,
            date: d.timestamp?.toDate ? d.timestamp.toDate().toISOString().split('T')[0] : null
        }
      }), null, 2)}

      Respond with a JSON object adhering to this schema: { "matchingIds": ["string"] }.
      The "matchingIds" array must contain the string IDs of the matched disputes.
      If no disputes match, return an empty array.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText);

    if (result && Array.isArray(result.matchingIds)) {
      return result.matchingIds;
    }
    return [];
  } catch (error) {
    console.error("Error filtering disputes with AI:", error);
    return disputes.map(d => d.id);
  }
};

export const filterPostsWithAI = async (query: string, posts: any[]): Promise<string[]> => {
  if (!query.trim()) {
    return posts.map(p => p.id);
  }

  try {
    const ai = getAi();
    const prompt = `
      You are an advanced filtering assistant for a community feed.
      Analyze the user's search query and the provided JSON list of posts.
      Return only the IDs of the posts that match the criteria in the query.
      The query might be about specific user names, user roles, keywords in the post text, visibility (public/private), or dates.

      User Query: "${query}"

      Post List (JSON):
      ${JSON.stringify(posts.map(p => ({
          id: p.id,
          userName: p.userName,
          userRole: p.userRole,
          text: p.text,
          visibility: p.visibility || 'public',
          isBlocked: p.isBlocked,
          date: p.timestamp?.toDate ? p.timestamp.toDate().toISOString().split('T')[0] : null
      })), null, 2)}

      Respond with a JSON object adhering to this schema: { "matchingIds": ["string"] }.
      The "matchingIds" array must contain the string IDs of the matched posts.
      If no posts match, return an empty array.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchingIds: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText);

    if (result && Array.isArray(result.matchingIds)) {
      return result.matchingIds;
    }
    return [];
  } catch (error) {
    console.error("Error filtering posts with AI:", error);
    return posts.map(p => p.id);
  }
};

export const enhanceImagePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const ai = getAi();
    const prompt = `An AI image generator failed to create an image from the following prompt, likely because it was too simple, ambiguous, or lacked detail: "${originalPrompt}"

Rewrite and enhance this prompt to be highly descriptive and visually rich, making it much more likely to generate a successful and interesting image. Add details about the subject, setting, lighting, style, and composition. Return only the new, improved prompt, without any explanation or preamble.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Error enhancing image prompt:", error);
    return originalPrompt;
  }
};

type ImageGenerationResult = 
  | { success: true; data: string }
  | { success: false; reason: 'SAFETY' | 'RECITATION' | 'NO_IMAGE' | 'UNKNOWN', message: string };

export const generateImageFromPrompt = async (prompt: string): Promise<ImageGenerationResult> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    
    if (response.promptFeedback?.blockReason) {
        return { success: false, reason: 'SAFETY', message: `Image generation failed: The prompt was blocked for safety reasons (${response.promptFeedback.blockReason}). Please modify your prompt.` };
    }

    const candidate = response.candidates?.[0];
    if (candidate) {
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            return { success: true, data: part.inlineData.data };
          }
        }
      }
      
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        const reason = candidate.finishReason;
        if (reason === 'SAFETY' || reason === 'RECITATION') {
            return { success: false, reason: 'SAFETY', message: `Image generation failed due to safety policies. Please modify your prompt to avoid sensitive or copyrighted content.` };
        }
        if (reason === 'NO_IMAGE') {
            return { success: false, reason: 'NO_IMAGE', message: `The AI could not generate an image from your prompt.` };
        }
        return { success: false, reason: 'UNKNOWN', message: `Image generation failed with an unexpected error. Reason: ${reason}.` };
      }
    }

    return { success: false, reason: 'UNKNOWN', message: "No image data found in AI response. The prompt may have been blocked or the model failed to generate an image." };

  } catch (error) {
    console.error("Error generating image with AI:", error);
    return { success: false, reason: 'UNKNOWN', message: "Failed to generate image. The AI service may be temporarily unavailable or the prompt was deemed unsafe." };
  }
};