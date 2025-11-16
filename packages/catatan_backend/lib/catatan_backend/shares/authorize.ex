defmodule CatatanBackend.Shares.Authorize do
  @moduledoc """
  Authorization logic for shareable links.
  Determines if a user can access a shared note based on access control settings.
  """

  alias CatatanBackend.Shares.Get

  @doc """
  Checks if a user can access a share based on authorization rules.

  ## Authorization Logic:
  - Public shares: Anyone can access (no authentication required)
  - Restricted shares: Requires authentication and user email must be in allowed_emails

  ## Parameters:
  - share_id: The share identifier
  - user: Map with "email" key (nil if unauthenticated)

  ## Returns:
  - {:ok, share} if access is granted
  - {:error, :not_found} if share doesn't exist
  - {:error, :unauthorized} if access is denied
  """
  @spec can_access?(String.t(), map() | nil) ::
          {:ok, map()} | {:error, :not_found | :unauthorized | term()}
  def can_access?(share_id, user \\ nil) do
    with {:ok, share} <- Get.get_share(share_id) do
      check_authorization(share, user)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  # Private functions

  defp check_authorization(share, user) do
    access_type = Map.get(share, "access_type", "public")

    case access_type do
      "public" ->
        {:ok, share}

      "restricted" ->
        authorize_restricted(share, user)

      _ ->
        # Unknown access type, default to unauthorized
        {:error, :unauthorized}
    end
  end

  defp authorize_restricted(share, nil) do
    # Restricted share requires authentication
    {:error, :unauthorized}
  end

  defp authorize_restricted(share, user) do
    user_email = Map.get(user, "email")
    allowed_emails = Map.get(share, "allowed_emails", [])

    cond do
      # No email in user object
      is_nil(user_email) ->
        {:error, :unauthorized}

      # Empty allowed list means no one can access
      Enum.empty?(allowed_emails) ->
        {:error, :unauthorized}

      # Check if user's email is in the allowed list
      email_in_allowed_list?(user_email, allowed_emails) ->
        {:ok, share}

      # User email not in allowed list
      true ->
        {:error, :unauthorized}
    end
  end

  defp email_in_allowed_list?(email, allowed_emails) do
    normalized_email = String.downcase(String.trim(email))

    Enum.any?(allowed_emails, fn allowed ->
      normalized_allowed = String.downcase(String.trim(allowed))
      normalized_email == normalized_allowed
    end)
  end
end
