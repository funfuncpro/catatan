defmodule CatatanBackend.Shares.Authorize do
  @moduledoc """
  Authorization logic for shareable links.
  Determines if a user can access a shared note based on access control settings.
  """

  alias CatatanBackend.Shares.Get

  @doc """
  Checks if a user can access a share based on authorization rules.

  ## Returns:
  - {:ok, share} if access is granted
  - {:error, :not_found} if share doesn't exist
  - {:error, :unauthorized} if access is denied
  """
  @spec can_access?(String.t(), map() | nil) ::
          {:ok, map()} | {:error, :not_found | :unauthorized | term()}
  def can_access?(share_id, user \\ nil) do
    IO.puts("\n=== AUTHORIZATION DEBUG ===")
    IO.puts("Share ID: #{inspect(share_id)}")
    IO.puts("User: #{inspect(user)}")

    with {:ok, share} <- Get.get_share(share_id) do
      IO.puts("Share data: #{inspect(share)}")
      result = check_authorization(share, user)
      IO.puts("Authorization result: #{inspect(result)}")
      IO.puts("=========================\n")
      result
    else
      {:error, reason} ->
        IO.puts("Get share error: #{inspect(reason)}")
        IO.puts("=========================\n")
        {:error, reason}
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
    user_email = Map.get(user, "email") || Map.get(user, :email)
    allowed_emails = Map.get(share, "allowed_emails", [])

    IO.puts("\n--- Authorize Restricted Debug ---")
    IO.puts("User email: #{inspect(user_email)}")
    IO.puts("User email type: #{inspect(is_binary(user_email))}")
    IO.puts("Allowed emails: #{inspect(allowed_emails)}")
    IO.puts("Allowed emails type: #{inspect(is_list(allowed_emails))}")
    IO.puts("Empty check: #{Enum.empty?(allowed_emails)}")

    cond do
      # No email in user object
      is_nil(user_email) ->
        IO.puts("FAIL: No email in user object")
        {:error, :unauthorized}

      # Empty allowed list -> no one can access
      Enum.empty?(allowed_emails) ->
        IO.puts("FAIL: Empty allowed list")
        {:error, :unauthorized}

      # Check if user's email is in the allowed list
      email_in_allowed_list?(user_email, allowed_emails) ->
        IO.puts("SUCCESS: Email found in allowed list")
        {:ok, share}

      # User email not in allowed list
      true ->
        IO.puts("FAIL: Email not in allowed list")
        {:error, :unauthorized}
    end
  end

  defp email_in_allowed_list?(email, allowed_emails) do
    normalized_email = String.downcase(String.trim(email))

    IO.puts("\n--- Email Comparison Debug ---")
    IO.puts("Looking for: #{inspect(normalized_email)}")

    result = Enum.any?(allowed_emails, fn allowed ->
      normalized_allowed = String.downcase(String.trim(allowed))
      IO.puts("Comparing with: #{inspect(normalized_allowed)}")
      IO.puts("Match: #{normalized_email == normalized_allowed}")
      normalized_email == normalized_allowed
    end)

    IO.puts("Final result: #{result}")
    IO.puts("------------------------------\n")
    result
  end
end
