# encoding: utf-8
require 'mime/types'
require 'pg'
require 'sequel'
require_relative '../../services/data-repository/filesystem/s3/backend'

class Asset < Sequel::Model
  PUBLIC_ATTRIBUTES = %W{ id public_url user_id }

  attr_accessor :asset_file, :remote, :configuration
  attr_reader   :user, :user_id

  def initialize(*args)
    super(*args)
    @configuration  ||= Cartodb.config
    @remote         ||= DataRepository::Filesystem::S3::Backend.new
    self.raise_on_save_failure = true
  end #initialize

  def public_values
    Hash[PUBLIC_ATTRIBUTES.map { |attribute| [attribute, send(attribute)] }]
  end #public_values

  def save(*args)
    super(*args)
    upload(asset_file) unless asset_file.nil? || asset_file.empty?
  end #save

  def destroy(*args)
    super(*args)
    remove_remote_file unless public_url.nil? || public_url.empty?
  end #after_destroy

  def validate
    super
    errors.add(:user_id, "can't be blank")          if user_id.nil?
    errors.add(:asset_file, "is invalid")           if unreadable?
    errors.add(:asset_file, "is too big, 10Mb max") if too_big?
  end #validate

  def user=(user)
    @user = user
    set(user_id: user.id)
  end #user=

  def upload(file)
    url = remote.store(remote_path, File.open(asset_file))
    set(public_url: url.to_s)
  end #upload

  def remove_remote_file
    remote.delete(path_for(public_url))
  end #remove_remote_file

  private

  def prefix
    File.join('user', user.username, 'assets')
  end #prefix

  def basename
    File.basename(asset_file)
  end #basename

  def remote_path
    "#{prefix}/#{basename}"
  end #remote_path

  def object_options
    { acl: :public_read, content_type: mime_type }
  end #object_options

  def mime_type
    MIME::Types.type_for(file_prefix).first.to_s
  end #mime_type

  def unreadable?
    !File.readable?(asset_file)
  end # unreadable?

  def payload
    File.open(asset_file)
  rescue Errno::ENOENT
    false
  end #file_or_prefix?

  def too_big?
    File.size(asset_file) > configuration.fetch(:assets).fetch('max_file_size')
  rescue Errno::ENOENT
    false
  end #too_big?
end # Asset

