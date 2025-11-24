defmodule CatatanBackend.Email do
  @spec send_registration_confirmation(%{
          email: String.t(),
          verification_code: String.t()
        }) :: :ok | {:error, term()}

  def send_registration_confirmation(%{email: email, verification_code: verification_code}) do
    CatatanBackend.Email.Producer.enqueue_async(%{
      to: email,
      subject: "Confirm your registration",
      type: :registration,
      data: %{verification_code: verification_code}
    })
  end
end
