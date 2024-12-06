from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.category import Category
from models.users import User




category_bp = Blueprint('category_controller', __name__)


@category_bp.route('/allcategory', methods=['GET'])
def get_all_category():
    try:
        categories = db.session.query(Category).all()
        return jsonify([category.to_dict() for category in categories]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all categories'}), 500

@category_bp.route('/<int:category_id>', methods=['GET'])
def get_category(category_id):
    try:
        category = db.session.query(Category).filter_by(category_id=category_id).first()
        if category is None:
            return jsonify({'error': 'Category not found'}), 404
        return jsonify(category.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get category'}), 500

@category_bp.route('/createcategory', methods=['POST'])
@jwt_required()
def create_category():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'category_name' not in data:
        return jsonify({'error': 'Missing category name'}), 400
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if user is None:
            return jsonify({'error': 'Unauthorized: User not found only admin can create category'}), 404
        if user.role != 'admin':
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        
        new_category = Category(category_name=data['category_name'])
        db.session.add(new_category)
        db.session.commit()
        return jsonify({'message': 'Category created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create category'}), 500


@category_bp.route('/updatecategory/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_category(category_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        category = db.session.query(Category).filter_by(category_id=category_id).first()
        if category is None:
            return jsonify({'error': 'Category not found'}), 404
        if user.role != 'admin':
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        category.category_name = data.get('category_name', category.category_name)
        category.status = data.get('status', category.status)
        db.session.commit()
        return jsonify({'message': 'Category updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update category'}), 500
    
@category_bp.route('/deletecategory/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    current_user_id = int(get_jwt_identity())

    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        category = db.session.query(Category).filter_by(category_id=category_id).first()
        if category is None:
            return jsonify({'error': 'Category not found'}), 404
        if user.role != 'admin':
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Category deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete category'}), 500
        