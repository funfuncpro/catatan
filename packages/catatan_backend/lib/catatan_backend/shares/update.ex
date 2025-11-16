defmodule CatatanBackend.Shares.Update do
  @moduledoc """
  Module responsible for updating share permissions and access control settings.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Updates the access control settings for a share.

  ## Parameters:
  - share_id: The share identifier
  - access_type: "public" or "restricted"
  - allowed_emails: List of email addresses (only used for restricted shares)

  ## Returns:
  - :ok if update successful
  - {:error, :not_found} if share doesn't exist
  - {:error, reason} for other errors
  """
  @spec update_permissions(String.t(), String.t(), list(String.t())) ::
          :ok | {:error, :not_found | term()}
  def update_permissions(share_id, access_type, allowed_emails \\ []) do
    # Verify share exists first
    with {:ok, _share} <- CatatanBackend.Shares.Get.get_share(share_id),
         :ok <- do_update(share_id, access_type, allowed_emails) do
      :ok
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp do_update(share_id, access_type, allowed_emails) do
    # Convert list to Cassandra set
    emails_set = MapSet.new(allowed_emails)

    query =
      "UPDATE notes_by_share SET access_type = :access_type, allowed_emails = :allowed_emails " <>
        "WHERE share_id = :share_id"

    params = %{
      "share_id" => share_id,
      "access_type" => access_type,
      "allowed_emails" => emails_set
    }

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, _result} <- CassandraClient.execute(prepared, params) do
      :ok
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Adds emails to the allowed list for a restricted share.

  ## Parameters:
  - share_id: The share identifier
  - emails: List of email addresses to add

  ## Returns:
  - :ok if update successful
  - {:error, reason} for errors
  """
  @spec add_allowed_emails(String.t(), list(String.t())) ::
          :ok | {:error, :not_found | term()}
  def add_allowed_emails(share_id, emails) when is_list(emails) do
    with {:ok, share} <- CatatanBackend.Shares.Get.get_share(share_id) do
      current_emails = Map.get(share, "allowed_emails", [])
      updated_emails = Enum.uniq(current_emails ++ emails)
      access_type = Map.get(share, "access_type", "public")

      do_update(share_id, access_type, updated_emails)
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Removes emails from the allowed list for a restricted share.

  ## Parameters:
  - share_id: The share identifier
  - emails: List of email addresses to remove

  ## Returns:
  - :ok if update successful
  - {:error, reason} for errors
  """
  @spec remove_allowed_emails(String.t(), list(String.t())) ::
          :ok | {:error, :not_started | term()}
  def remove_allowed_emails(share_id, emails) when is_list(emails) do
    with {:ok, share} <- CatatanBackend.Shares.Get.get_share(share_id) do
      current_emails = Map.get(share, "allowed_emails", [])
      updated_emails = Enum.reject(current_emails, fn email -> email in emails end)
      access_type = Map.get(share, "access_type", "public")

      do_update(share_id, access_type, updated_emails)
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
