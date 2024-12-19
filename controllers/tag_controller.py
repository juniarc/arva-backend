from flask import jsonify, request, Blueprint
from models.tags import Tag
from models.users import User
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db



tag_bp = Blueprint('tag_controller', __name__)


@tag_bp.route('/alltag', methods=['GET'])
def get_alltag():
    try:
        tags = db.session.query(Tag).all()
        return jsonify([tag.to_dict() for tag in tags]),200
    except Exception as e:
        return jsonify({'error': f'Failed to get all tag {e}'}),500

@tag_bp.route('/<int:tag_id>', methods=['GET'])
def get_tag(tag_id):
    try:
        tag = db.session.query(Tag).filter_by(tag_id=tag_id).first()
        if tag is None:
            return jsonify({'error':'Tag not Found'}), 404
        return jsonify(tag.to_dict()), 200
    except Exception as e:
        return jsonify({'error':'Failed to get tag'}), 500
    
@tag_bp.route('/gettagbytagname/<string:tag_name>', methods=['GET'])
def get_tag_by_tag_name(tag_name):
    tag_name=tag_name.lower()
    try:
        tag = db.session.query(Tag).filter_by(tag_name=tag_name).first()
        if tag is None:
            return jsonify({'error':'Tag not Found'}), 404
        return jsonify(tag.to_dict()), 200
    except Exception as e:
        return jsonify({'error':'Failed to get tag'}), 500
    
@tag_bp.route('/createtag', methods=['POST'])
@jwt_required()
def create_tag():
    data = request.get_json()
    current_user_id = get_jwt_identity()
    lower_tag_name = data['tag_name'].lower()

    if data is None:
        return jsonify({'error':'No data Provided'}),400
    elif 'tag_name' not in data:
        return jsonify({'error': "Missing: tag name"}), 400
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if user is None:
            return jsonify({'error': 'Unauthorizeed: User not found'}), 401
        new_tag = Tag(tag_name= lower_tag_name)
        db.session.add(new_tag)
        db.session.commit()
        return jsonify({'message': 'Tag created successfully', 'tag': new_tag.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to created Tag'}), 500
    

@tag_bp.route('/updatetag/<int:tag_id>', methods=['PUT'])
@jwt_required()
def update_tag(tag_id):
    data = request.get_json()
    current_user_id = get_jwt_identity()
    data['tag_name'] = data['tag_name'].lower()

    if data is None:
        return jsonify({'error': 'No data Provided'}), 400
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        tag = db.session.query(Tag).filter_by(tag_id=tag_id).first()
        if tag is None:
            return jsonify({'error': 'Tag not found'}), 404
        elif user is None:
            return jsonify({'error': 'Unauthorized: User not found'}), 401
        tag.tag_name = data.get('tag_name', tag.tag_name)
        tag.status = data.get('status',tag.status)
        db.session.commit()
        return jsonify({'message': 'Tag update successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update Tag'}), 500
    
@tag_bp.route('/deactivate/<int:tag_id>', methods=['PUT'])
@jwt_required()
def deactivate_tag(tag_id):
    data = request.get_json()
    current_user_id = get_jwt_identity()

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'status' not in data:
        return jsonify({'error': 'Missing data status'}), 400
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        tag = db.session.query(Tag).filter_by(tag_id=tag_id).first()
        if tag is None:
            return jsonify({'error': 'Tag not Found'}), 404
        elif user is None:
            return jsonify({'error': 'Unauthorized: User not Found'}), 401
        
        tag.status = data.get('status', tag.status)
        db.session.commit()
        return jsonify({'message': 'Tag deactivated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to deactivate'}),500
    
@tag_bp.route('/delete/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def delete_tag(tag_id):
    current_user_id = get_jwt_identity()

    try:
        tag = db.session.query(Tag).filter_by(tag_id=tag_id).first()
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if tag is None:
            return jsonify({'error': 'Tag not found'}), 404
        elif user is None:
            return jsonify({'error': 'Unauthorized: User not found'}), 401
        elif user.role != 'admin':
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(tag)
        db.session.commit()
        return jsonify({'message': 'Tag deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete tag {e}'}), 500



