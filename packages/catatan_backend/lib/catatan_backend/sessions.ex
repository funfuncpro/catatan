defmodule CatatanBackend.Sessions do
  @moduledoc """
  Public module for Sessions context in the CatatanBackend application.

  This module provides the public API for creating and managing user sessions
  for anonymous note-taking.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Sessions.Create
  alias CatatanBackend.Sessions.Get

  @doc """
  Creates a new session for a given note.
  """
  @spec create_session(String.t()) :: {:ok, map()} | {:error, term()}
  def create_session(note_id) do
    Create.insert_session(
      GenerateID.generate_nano_id(),
      note_id,
      DateTime.utc_now() |> DateTime.to_unix(:millisecond)
    )
  end

  @doc """
  Retrieves the note_id associated with a session.
  """
  @spec get_note_id(String.t()) :: {:ok, String.t()} | {:error, :not_found | term()}
  def get_note_id(session_id) do
    Get.get_note_id_by_session(session_id)
  end

  @doc """
  Checks if a session is valid.
  """
  @spec valid_session?(String.t()) :: {:ok, true} | {:error, :not_found | term()}
  def valid_session?(session_id) do
    Get.session_exists?(session_id)
  end
end
