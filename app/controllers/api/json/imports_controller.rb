class Api::Json::ImportsController < Api::ApplicationController

  if Rails.env.production?
    ssl_required :all
  end

  def index
    imports = DataImport.filter(:user_id => current_user.id).all

    render :json => {:imports => imports, :success => true}
  end

  def show
    import = DataImport.filter(:queue_id => params[:id]).first

    import_values = import.values rescue {}

    success = import_values[:state].blank? || import_values[:state] != 'failure'
    render :json => {:import => import_values, :success => success}, :status => success ? :ok : :unprocessable_entity
  end

  def create
    job_meta = Resque::ImporterJobs.enqueue(current_user[:id], params[:table_name], params[:file_uri]) 
    render :json => {:item_queue_id => job_meta.meta_id, :success => true}
  end
end