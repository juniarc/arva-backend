from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.image_product import ImageProduct
from models.shops import Shop
from models.products import Product
import datetime


image_product_bp = Blueprint('image_product_controller', __name__)


@image_product_bp.route('/<int:product_id>', methods=['GET'])
def get_image_product(product_id):
    try:
        image_product = db.session.query(ImageProduct).filter_by(product_id=product_id).all()
        return jsonify([image.to_dict() for image in image_product]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get image'}), 500
    
@image_product_bp.route('/allimage', methods=['GET'])
def get_all_image_product():
    try:
        image_product = db.session.query(ImageProduct).all()
        return jsonify([image.to_dict() for image in image_product]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get images{e}'}), 500
    
@image_product_bp.route('/uploadimage/<int:product_id>', methods=['POST'])
@jwt_required()
def upload_image(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error':'No data provided'}), 400
    elif 'image_data' not in data:
        return jsonify({'error': 'Missing image data'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'erorr': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        
        image_product = ImageProduct(image_data=data['image_data'], product_id=product_id)

        db.session.add(image_product)
        db.session.commit()
        return jsonify({'message': 'Image uploaded successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload image'}), 500

@image_product_bp.route('/changeimage/<int:product_id>', methods=['PUT'])
@jwt_required()
def change_image(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error':'No data provided'}), 400 
    elif 'image_data' not in data:
        return jsonify({'error': 'Missing image data'}), 400
    
    try:
        image_product = db.session.query(ImageProduct).filter_by(product_id=product_id).first()
        if image_product is None:
            return jsonify({'error': 'Image not found'}), 404
        if image_product.product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401        
        image_product.image_data = data['image_data']
        db.session.commit()
        return jsonify({'message': 'Image changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to change image'}), 500



@image_product_bp.route('/deleteimage/<int:image_id>', methods=['DELETE'])
@jwt_required()
def delete_image(image_id):
    current_user_id = int(get_jwt_identity())
    try:
        image_product = db.session.query(ImageProduct).filter_by(image_id=image_id).first()
        if image_product is None:
            return jsonify({'error': 'Image not found'}), 404
        if image_product.product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(image_product)
        db.session.commit()
        return jsonify({'message': 'Image deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete image'}), 500


#upload multiple images
@image_product_bp.route('/uploadmultipleimage/<int:product_id>', methods=['POST'])
@jwt_required()
def upload_multiple_images(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error':'No data provided'}), 400
    elif 'image_data' not in data:
        return jsonify({'error': 'Missing image data'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'erorr': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        
        for image_data in data['image_data']:
            image_product = ImageProduct(image_data=image_data, product_id=product_id)
            db.session.add(image_product)
        db.session.commit()
        return jsonify({'message': 'Images uploaded successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload images'}), 500


