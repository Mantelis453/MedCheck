/*
  # Add Image Support to Conversation Messages

  ## Overview
  This migration adds support for images in conversation messages, allowing users to:
  - Upload images to ask questions to the AI assistant
  - Store image URLs in messages
  - Track image metadata (size, type)

  ## Changes

  ### Modifications to `conversation_messages` table
  - Add `image_url` column for storing image URLs
  - Add `image_mime_type` column for storing image type
  - Add `has_image` column for quick filtering

  ## Storage
  - Images will be stored in Supabase Storage bucket 'chat-images'
  - Images are organized by user_id/conversation_id/message_id
  
  ## Security
  - RLS policies already exist for conversation_messages table
  - Storage policies will be created for the chat-images bucket
*/

-- Add image support columns to conversation_messages
-- This migration is idempotent and safe to run multiple times
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_messages'
  ) THEN
    -- Add image_url column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversation_messages' 
        AND column_name = 'image_url'
    ) THEN
      ALTER TABLE conversation_messages ADD COLUMN image_url text;
      RAISE NOTICE 'Added image_url column to conversation_messages';
    END IF;

    -- Add image_mime_type column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversation_messages' 
        AND column_name = 'image_mime_type'
    ) THEN
      ALTER TABLE conversation_messages ADD COLUMN image_mime_type text;
      RAISE NOTICE 'Added image_mime_type column to conversation_messages';
    END IF;

    -- Add has_image column
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversation_messages' 
        AND column_name = 'has_image'
    ) THEN
      ALTER TABLE conversation_messages ADD COLUMN has_image boolean DEFAULT false NOT NULL;
      RAISE NOTICE 'Added has_image column to conversation_messages';
    END IF;
  ELSE
    RAISE NOTICE 'conversation_messages table does not exist. Please run the base migration first.';
  END IF;
END $$;

-- Create storage bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for chat images
DO $$
BEGIN
  -- Policy for users to upload their own images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload chat images'
  ) THEN
    CREATE POLICY "Users can upload chat images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'chat-images' AND
        (storage.foldername(name))[1] = (select auth.uid())::text
      );
  END IF;

  -- Policy for users to view their own images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view own chat images'
  ) THEN
    CREATE POLICY "Users can view own chat images"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'chat-images' AND
        (storage.foldername(name))[1] = (select auth.uid())::text
      );
  END IF;

  -- Policy for users to delete their own images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own chat images'
  ) THEN
    CREATE POLICY "Users can delete own chat images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'chat-images' AND
        (storage.foldername(name))[1] = (select auth.uid())::text
      );
  END IF;
END $$;
