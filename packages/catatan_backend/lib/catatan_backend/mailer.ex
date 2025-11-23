defmodule CatatanBackend.SESMailer do
  @moduledoc """
  Mailer module using Swoosh for sending emails via AWS SES.
  """
  use Swoosh.Mailer, otp_app: :catatan_backend
end
