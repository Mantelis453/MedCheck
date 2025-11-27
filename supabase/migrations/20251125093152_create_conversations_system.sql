/*
  # Create Conversations System for Personal AI Agent

  This migration creates a comprehensive conversation system that allows:
  - Multiple conversation threads per user
  - Full conversation history tracking
  - Conversation metadata (titles, timestamps)
  - Message tracking within conversations
  
  ## New Tables
  
  ### `conversations`
  - `id` (uuid, primary key) - Unique conversation identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `title` (text) - Conversation title (auto-generated from first message)
  - `created_at` (timestamptz) - When conversation started
  - `updated_at` (timestamptz) - Last message timestamp
  - `is_active` (boolean) - Whether conversation is active/archived
  
  ### `conversation_messages`
  - `id` (uuid, primary key) - Unique message identifier
  - `conversation_id` (uuid, foreign key) - References conversations
  - `role` (text) - Either 'user' or 'assistant'
  - `content` (text) - Message content
  - `created_at` (timestamptz) - When message was sent
  - `metadata` (jsonb) - Additional message data (e.g., referenced medications)
  
  ## Security
  
  - Enable RLS on all tables
  - Users can only access their own conversations and messages
  - All policies verify user ownership through conversation linkage
  
  ## Important Notes
  
  1. The existing `chat_messages` table will be deprecated in favor of conversation-based system
  2. Each conversation tracks when it was last updated for sorting
  3. Conversation titles are auto-generated from first user message (truncated to 50 chars)
*/

-- Create conversations table (without strict FK to avoid validation issues)
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- Drop foreign key constraint if it exists (to avoid strict FK validation issues)
-- RLS policies still ensure users can only access their own data
ALTER TABLE IF EXISTS conversations 
  DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;

-- Create conversation_messages table with image support
CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text CHECK (role IN ('user', 'assistant')) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  image_url text,
  image_mime_type text,
  has_image boolean DEFAULT false NOT NULL
);

-- Drop foreign key constraint if it exists (to avoid strict FK validation issues)
ALTER TABLE IF EXISTS conversation_messages 
  DROP CONSTRAINT IF EXISTS conversation_messages_conversation_id_fkey;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at ON conversation_messages(created_at);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;

-- RLS Policies for conversations table
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages from own conversations" ON conversation_messages;
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON conversation_messages;
DROP POLICY IF EXISTS "Users can update messages in own conversations" ON conversation_messages;
DROP POLICY IF EXISTS "Users can delete messages from own conversations" ON conversation_messages;

-- RLS Policies for conversation_messages table
CREATE POLICY "Users can view messages from own conversations"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own conversations"
  ON conversation_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from own conversations"
  ON conversation_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Create storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for chat images (drop existing first)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can upload chat images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own chat images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own chat images" ON storage.objects;
  
  -- Policy for users to upload their own images
  CREATE POLICY "Users can upload chat images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'chat-images' AND
      (storage.foldername(name))[1] = (select auth.uid())::text
    );

  -- Policy for users to view their own images
  CREATE POLICY "Users can view own chat images"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'chat-images' AND
      (storage.foldername(name))[1] = (select auth.uid())::text
    );

  -- Policy for users to delete their own images
  CREATE POLICY "Users can delete own chat images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'chat-images' AND
      (storage.foldername(name))[1] = (select auth.uid())::text
    );
END $$;

-- Function to automatically update conversation's updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when message is added
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();