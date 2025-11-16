defmodule CatatanBackend.Shares do
  @moduledoc """
  Public module for Shares context in the CatatanBackend application.

  This module provides the public API for creating and managing shareable links
  for notes with authorization support.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Shares.Create
  alias CatatanBackend.Shares.Get
  alias CatatanBackend.Shares.Authorize
  alias CatatanBackend.Shares.Update

  @doc """
  Creates a shareable link for a given note with optional access control.

  ## Parameters:
  - note_id: The note identifier
  - access_type: "public" or "restricted" (defaults to "public")
  - allowed_emails: List of emails for restricted access (defaults to [])
  - created_by: User ID of the creator (nil for anonymous shares)

  ## Returns:
  - {:ok, share} with share_id and metadata
  - {:error, reason}
  """
  @spec create_share(String.t(), String.t(), list(String.t()), String.t() | nil) ::
          {:ok, map()} | {:error, term()}
  def create_share(note_id, access_type \\ "public", allowed_emails \\ [], created_by \\ nil) do
    case CatatanBackend.Notes.get_note_by_id(note_id) do
      {:ok, _note} ->
        Create.insert_share(
          note_id,
          GenerateID.generate_nano_id(),
          created_by,
          access_type,
          allowed_emails,
          DateTime.utc_now() |> DateTime.to_unix(:millisecond)
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Retrieves a note using a share_id with authorization check.

  ## Parameters:
  - share_id: The share identifier
  - current_user: User map with "email" key (nil if unauthenticated)

  ## Returns:
  - {:ok, note} if access is granted
  - {:error, :not_found} if share doesn't exist
  - {:error, :unauthorized} if access is denied
  """
  @spec get_note_by_share_id(String.t(), map() | nil) ::
          {:ok, map()} | {:error, :not_found | :unauthorized | term()}
  def get_note_by_share_id(share_id, current_user \\ nil) do
    with {:ok, _share} <- Authorize.can_access?(share_id, current_user),
         {:ok, note} <- Get.by_share_id(share_id) do
      {:ok, note}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves share metadata including access control settings.

  ## Returns:
  - {:ok, share} with all metadata
  - {:error, :not_found} if share doesn't exist
  """
  @spec get_share_info(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_share_info(share_id) do
    Get.get_share(share_id)
  end

  @doc """
  Updates the access control settings for a share.

  ## Parameters:
  - share_id: The share identifier
  - access_type: "public" or "restricted"
  - allowed_emails: List of email addresses

  ## Returns:
  - :ok if successful
  - {:error, reason}
  """
  @spec update_share_permissions(String.t(), String.t(), list(String.t())) ::
          :ok | {:error, term()}
  def update_share_permissions(share_id, access_type, allowed_emails) do
    Update.update_permissions(share_id, access_type, allowed_emails)
  end

  @doc """
  Adds emails to the allowed list for a restricted share.
  """
  @spec add_allowed_emails(String.t(), list(String.t())) :: :ok | {:error, term()}
  def add_allowed_emails(share_id, emails) do
    Update.add_allowed_emails(share_id, emails)
  end

  @doc """
  Removes emails from the allowed list for a restricted share.
  """
  @spec remove_allowed_emails(String.t(), list(String.t())) :: :ok | {:error, term()}
  def remove_allowed_emails(share_id, emails) do
    Update.remove_allowed_emails(share_id, emails)
  end
end
